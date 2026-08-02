import { describe, it, expect, vi, afterEach } from "vitest";
import { storeName, enrich } from "./enrich";

describe("storeName", () => {
  it("maps known storefronts", () => {
    expect(storeName("https://www.amazon.com/dp/x")).toBe("Amazon");
    expect(storeName("https://www.etsy.com/listing/1")).toBe("Etsy");
    expect(storeName("https://shop.bigcartel.com/product/y")).toBe("Big Cartel");
  });
  it("falls back to a capitalized registrable name", () => {
    expect(storeName("https://shop.example.com/x")).toBe("Example");
    expect(storeName("https://www.dearfoams.com/x")).toBe("Dearfoams");
  });
  it("returns null on non-URLs", () => {
    expect(storeName("not a url")).toBeNull();
  });
});

// Mock fetch: the page URL returns HTML; any other URL (the cover image, fetched
// by the focal-point step) 404s so computeFocal short-circuits without sharp.
function mockFetch(html: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/page"))
        return { ok: true, status: 200, text: async () => html };
      return { ok: false, status: 404 };
    }),
  );
}

describe("enrich", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("pulls Open Graph title, image, and store", async () => {
    mockFetch(`<html><head>
      <meta property="og:title" content="Cool Thing" />
      <meta property="og:image" content="https://cdn.example.com/img.jpg" />
    </head></html>`);
    const r = await enrich("https://store.example.com/page");
    expect(r.title).toBe("Cool Thing");
    expect(r.image_url).toBe("https://cdn.example.com/img.jpg");
    expect(r.store).toBe("Example");
    expect(r.focal_x).toBe(50); // image 404s → default focal
  });

  it("falls back to <title> and a product-image scan when OG is absent", async () => {
    mockFetch(`<html><head><title>My Page Title</title></head><body>
      <img src="/nav-logo.png" />
      <img src="https://cdn.example.com/hi-res/prod_01.jpg?sw=800" />
    </body></html>`);
    const r = await enrich("https://store.example.com/page");
    expect(r.title).toBe("My Page Title");
    expect(r.image_url).toContain("prod_01.jpg"); // logo skipped, product picked
  });

  it("resolves relative OG image URLs against the page", async () => {
    mockFetch(`<html><head>
      <meta property="og:title" content="Rel" />
      <meta property="og:image" content="/media/cover.png" />
    </head></html>`);
    const r = await enrich("https://store.example.com/page");
    expect(r.image_url).toBe("https://store.example.com/media/cover.png");
  });

  it("falls back to Shopify product JSON when og:image is a video thumbnail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (u: string) => {
        if (u.endsWith(".json"))
          return {
            ok: true,
            status: 200,
            json: async () => ({
              product: { images: [{ src: "https://cdn.shopify.com/real.jpg" }] },
            }),
          };
        if (u.includes("/products/"))
          return {
            ok: true,
            status: 200,
            text: async () =>
              `<html><head><meta property="og:image" content="https://x/preview_images/a.thumbnail.0000000000.jpg" /></head></html>`,
          };
        return { ok: false, status: 404 };
      }),
    );
    const r = await enrich("https://store.example.com/products/divergence");
    expect(r.image_url).toBe("https://cdn.shopify.com/real.jpg");
  });

  it("degrades gracefully on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500 })));
    const r = await enrich("https://store.example.com/page");
    expect(r.title).toBeNull();
    expect(r.image_url).toBeNull();
    expect(r.store).toBe("Example");
  });
});
