import { parse } from "node-html-parser";

export interface Enriched {
  url: string;
  title: string | null;
  image_url: string | null;
  store: string | null;
  focal_x: number; // visual-center crop point, 0–100 (%)
  focal_y: number;
}

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
      return { url, title: null, image_url: null, store, focal_x: 50, focal_y: 50 };

    const html = await res.text();
    const root = parse(html);

    const title =
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
    };
  } catch {
    // Timeout, DNS failure, blocked, etc. — degrade to a bare link.
    return { url, title: null, image_url: null, store, focal_x: 50, focal_y: 50 };
  }
}
