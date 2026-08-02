import { parse } from "node-html-parser";

export interface Enriched {
  url: string;
  title: string | null;
  image_url: string | null;
  store: string | null;
  focal_x: number; // visual-center crop point, 0–100 (%)
  focal_y: number;
  // itch.io-only extras. `platforms` is [] and the rest null on every other host.
  platforms: string[]; // e.g. ["Windows", "Linux", "Web"]
  dev_status: string | null; // itch's dev status, e.g. "Released", "In development"
  updated_at: string | null; // ISO timestamp of the game's last update
}

// Fields the generic path leaves empty; spread into every `enrich` return so a
// non-itch page carries the itch keys as their neutral defaults.
const NO_ITCH = { platforms: [] as string[], dev_status: null, updated_at: null };

const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Content-aware "visual center" for an image, à la Twitter's saliency crop.
 * Downloads the image and runs smartcrop for a 4:3 target, returning the crop
 * center as percentages. Dynamically imports the native deps so any failure
 * degrades to dead-center (50/50) instead of crashing the caller.
 */
async function computeFocal(imageUrl: string): Promise<{ x: number; y: number }> {
  const fallback = { x: 50, y: 50 };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(imageUrl, {
      headers: { "User-Agent": UA },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return fallback;

    const buf = Buffer.from(await res.arrayBuffer());
    const [{ default: sharp }, { default: smartcrop }] = await Promise.all([
      import("sharp"),
      import("smartcrop-sharp"),
    ]);
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height) return fallback;

    const { topCrop: c } = await smartcrop.crop(buf, { width: 100, height: 75 });
    return {
      x: clampPct(((c.x + c.width / 2) / meta.width) * 100),
      y: clampPct(((c.y + c.height / 2) / meta.height) * 100),
    };
  } catch {
    return fallback;
  }
}

// Pretend to be a real browser — many storefronts serve thin/blocked HTML to
// obvious bots. This is best-effort; failures fall back to a bare URL.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/125.0 Safari/537.36";

/** Human-friendly storefront label from the hostname. */
export function storeName(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const known: Record<string, string> = {
      "amazon.com": "Amazon",
      "ebay.com": "eBay",
      "etsy.com": "Etsy",
      "bigcartel.com": "Big Cartel",
      "itch.io": "itch.io",
    };
    for (const [domain, label] of Object.entries(known)) {
      if (host === domain || host.endsWith("." + domain)) return label;
    }
    // Fallback: the registrable-ish name, e.g. "shop.example" -> "example".
    const parts = host.split(".");
    const base = parts.length >= 2 ? parts[parts.length - 2] : host;
    return base.charAt(0).toUpperCase() + base.slice(1);
  } catch {
    return null;
  }
}

function meta(root: ReturnType<typeof parse>, ...keys: string[]): string | null {
  for (const key of keys) {
    const el =
      root.querySelector(`meta[property="${key}"]`) ??
      root.querySelector(`meta[name="${key}"]`);
    const content = el?.getAttribute("content")?.trim();
    if (content) return content;
  }
  return null;
}

type El = ReturnType<typeof parse>;

// Shopify sets og:image to a video's frame-0 thumbnail (usually black).
const isVideoThumb = (u: string) => /preview_images|thumbnail\.\d{6,}/i.test(u);

/**
 * Shopify product pages hydrate their images client-side, but expose them at
 * `/products/<handle>.json`. Use the first real image when the page's image is
 * missing or a video thumbnail.
 */
async function shopifyImage(pageUrl: string): Promise<string | null> {
  try {
    const u = new URL(pageUrl);
    const m = u.pathname.match(/\/products\/[^/?#]+/);
    if (!m) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${u.origin}${m[0]}.json`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      product?: { images?: { src?: string }[]; image?: { src?: string } };
    };
    const imgs = data.product?.images;
    if (Array.isArray(imgs) && imgs[0]?.src) return imgs[0].src;
    return data.product?.image?.src ?? null;
  } catch {
    return null;
  }
}

/** Pull the first usable image URL out of any JSON-LD blocks on the page. */
export function jsonLdImage(root: El): string | null {
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    let data: unknown;
    try {
      data = JSON.parse(s.text);
    } catch {
      continue;
    }
    const found = searchImage(data);
    if (found) return found;
  }
  return null;
}

function pickUrl(v: unknown): string | null {
  if (typeof v === "string" && /^https?:\/\//.test(v)) return v;
  if (Array.isArray(v)) {
    for (const x of v) {
      const u = pickUrl(x);
      if (u) return u;
    }
  }
  if (v && typeof v === "object") {
    const url = (v as { url?: unknown }).url;
    if (typeof url === "string" && /^https?:\/\//.test(url)) return url;
  }
  return null;
}

function searchImage(obj: unknown): string | null {
  if (!obj || typeof obj !== "object") return null;
  for (const [key, value] of Object.entries(obj)) {
    if (key === "image") {
      const u = pickUrl(value);
      if (u) return u;
    }
    if (value && typeof value === "object") {
      const nested = searchImage(value);
      if (nested) return nested;
    }
  }
  return null;
}

// Filenames that are almost never the product: chrome, not content.
const BAD_IMG =
  /logo|icon|sprite|favicon|nav|menu|flag|badge|payment|placeholder|blank|pixel|loader|spinner|\.svg(\?|$)/i;

/**
 * Last-resort: scan <img> tags and pick the most product-looking one.
 * Scores by size hints and hi-res/product path markers. Heuristic, not perfect.
 */
export function scanForProductImage(root: El, baseUrl: string): string | null {
  let best: { url: string; score: number } | null = null;
  for (const img of root.querySelectorAll("img")) {
    let src =
      img.getAttribute("src") ||
      img.getAttribute("data-src") ||
      img.getAttribute("data-image") ||
      "";
    const srcset = img.getAttribute("srcset") || img.getAttribute("data-srcset");
    if (!src && srcset) src = srcset.split(",")[0].trim().split(/\s+/)[0];
    if (!src || src.startsWith("data:") || BAD_IMG.test(src)) continue;

    let abs: string;
    try {
      abs = new URL(src, baseUrl).toString();
    } catch {
      continue;
    }
    if (!/^https?:\/\//.test(abs)) continue;

    let score = 0;
    if (/hi-?res|large|zoom|_\d{2}\.(jpg|jpeg|png|webp)/i.test(abs)) score += 2;
    if (/product/i.test(abs)) score += 1;
    const size = abs.match(/[?&](?:sw|w|width)=(\d+)/i);
    if (size) score += Math.min(3, Math.floor(parseInt(size[1], 10) / 300));

    if (!best || score > best.score) best = { url: abs, score };
  }
  return best?.url ?? null;
}

const isItch = (url: string) => {
  try {
    return /(^|\.)itch\.io$/.test(new URL(url).hostname);
  } catch {
    return false;
  }
};

// itch's download buttons carry a platform icon; the class is the source of
// truth (the "Platforms" info row can lag behind the actual uploads).
const ITCH_PLATFORM: Record<string, string> = {
  windows8: "Windows",
  tux: "Linux",
  apple: "macOS",
  android: "Android",
  html5: "Web",
};

/** Clean product name from an itch page's JSON-LD (`og:title` is absent there). */
function jsonLdName(root: El): string | null {
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(s.text) as { "@type"?: string; name?: string };
      if (data["@type"] === "Product" && typeof data.name === "string")
        return data.name.trim();
    } catch {
      /* skip malformed block */
    }
  }
  return null;
}

export interface ItchDetails {
  title: string | null; // clean game name (no " by <author>" suffix)
  platforms: string[];
  dev_status: string | null;
  updated_at: string | null; // ISO, or null if unparseable/absent
}

/**
 * Pull itch.io-specific fields out of a parsed game page:
 * the dev status + last-updated date from the info-panel table, and the
 * supported platforms from the download buttons' icon classes.
 */
export function parseItchDetails(root: El): ItchDetails {
  // Info panel is a two-column table of <td>Label</td><td>value</td> rows.
  const rows: Record<string, El> = {};
  for (const tr of root.querySelectorAll(".game_info_panel_widget tr")) {
    const cells = tr.querySelectorAll("td");
    if (cells.length >= 2) rows[cells[0].text.trim()] = cells[1];
  }

  const dev_status = rows["Status"]?.text.trim() || null;

  // The date cell holds an <abbr title="30 July 2026 @ 12:17 UTC">…</abbr> with
  // the exact time. Prefer "Updated"; older/established pages instead show only
  // "Published" or "Release date" (and some show no date row at all).
  const abbr = ["Updated", "Published", "Release date"]
    .map((k) => rows[k]?.querySelector("abbr"))
    .find(Boolean);
  const raw = abbr?.getAttribute("title")?.replace(" @ ", " ") ?? null;
  let updated_at: string | null = null;
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) updated_at = d.toISOString();
  }

  // Primary source: platform icons on the download/buy buttons.
  const fromIcons = root
    .querySelectorAll(".download_platforms .icon")
    .flatMap((el) =>
      (el.getAttribute("class") ?? "")
        .split(/\s+/)
        .map((c) => ITCH_PLATFORM[c.replace(/^icon-/, "")])
        .filter((p): p is string => Boolean(p)),
    );

  // Fallback: the info-panel "Platforms" row (web-only games may have a play
  // button instead of download buttons). The row spells the web platform
  // "HTML5", so match on keywords rather than the display labels.
  const rowText = rows["Platforms"]?.text ?? "";
  const ROW_MATCHERS: [RegExp, string][] = [
    [/windows/i, "Windows"],
    [/mac ?os|osx/i, "macOS"],
    [/linux/i, "Linux"],
    [/android/i, "Android"],
    [/html5|web|browser/i, "Web"],
  ];
  const fromRow = ROW_MATCHERS.filter(([re]) => re.test(rowText)).map(([, p]) => p);

  const platforms = [...new Set([...fromIcons, ...fromRow])];

  return { title: jsonLdName(root), platforms, dev_status, updated_at };
}

/**
 * Fetch a product page and pull Open Graph / meta tags.
 * Universal path — no per-store code. Always resolves; never throws.
 */
export async function enrich(url: string): Promise<Enriched> {
  const store = storeName(url);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!res.ok)
      return { url, title: null, image_url: null, store, focal_x: 50, focal_y: 50, ...NO_ITCH };

    const html = await res.text();
    const root = parse(html);

    // itch omits og:title, so prefer its JSON-LD product name (no author suffix).
    const itch = isItch(url) ? parseItchDetails(root) : null;

    const title =
      itch?.title ??
      meta(root, "og:title", "twitter:title") ??
      root.querySelector("title")?.text?.trim() ??
      null;

    // Image: prefer OG/Twitter, then progressively fall back to other sources
    // for sites (e.g. Salesforce Commerce) that don't emit og:image.
    let image =
      meta(root, "og:image", "og:image:url", "twitter:image") ??
      root.querySelector('link[rel="image_src"]')?.getAttribute("href") ??
      root.querySelector('meta[itemprop="image"]')?.getAttribute("content") ??
      jsonLdImage(root) ??
      scanForProductImage(root, url);

    // Shopify: og:image is often a black video thumbnail — grab the real image.
    if (!image || isVideoThumb(image)) {
      const shop = await shopifyImage(url);
      if (shop) image = shop;
    }

    // Resolve protocol-relative or relative image URLs against the page.
    if (image) {
      try {
        image = new URL(image, url).toString();
      } catch {
        /* leave as-is */
      }
    }

    const focal = image ? await computeFocal(image) : { x: 50, y: 50 };

    return {
      url,
      title,
      image_url: image ?? null,
      store,
      focal_x: focal.x,
      focal_y: focal.y,
      platforms: itch?.platforms ?? [],
      dev_status: itch?.dev_status ?? null,
      updated_at: itch?.updated_at ?? null,
    };
  } catch {
    // Timeout, DNS failure, blocked, etc. — degrade to a bare link.
    return { url, title: null, image_url: null, store, focal_x: 50, focal_y: 50, ...NO_ITCH };
  }
}
