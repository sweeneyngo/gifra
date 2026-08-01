import { parse } from "node-html-parser";

export interface Enriched {
  url: string;
  title: string | null;
  image_url: string | null;
  store: string | null;
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

/**
 * Fetch a product page and pull Open Graph / meta tags.
 * Universal path — no per-store code. Always resolves; never throws.
 */
export async function enrich(url: string): Promise<Enriched> {
  const store = storeName(url);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!res.ok) return { url, title: null, image_url: null, store };

    const html = await res.text();
    const root = parse(html);

    const title =
      meta(root, "og:title", "twitter:title") ??
      root.querySelector("title")?.text?.trim() ??
      null;

    let image = meta(root, "og:image", "og:image:url", "twitter:image");
    // Resolve protocol-relative or relative image URLs against the page.
    if (image) {
      try {
        image = new URL(image, url).toString();
      } catch {
        /* leave as-is */
      }
    }

    return { url, title, image_url: image ?? null, store };
  } catch {
    // Timeout, DNS failure, blocked, etc. — degrade to a bare link.
    return { url, title: null, image_url: null, store };
  }
}
