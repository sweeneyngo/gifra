import { describe, it, expect, vi, afterEach } from "vitest";
import { parse } from "node-html-parser";
import {
  storeName,
  enrich,
  scanForProductImage,
  jsonLdImage,
  parseItchDetails,
  latestRssDate,
} from "./enrich";

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
  it("labels itch.io", () => {
    expect(storeName("https://dev.itch.io/game")).toBe("itch.io");
  });
});

// A trimmed-down copy of a real itch.io game page: JSON-LD product name, the
// info-panel table (Updated/Status/Platforms), and platform download icons.
const ITCH_HTML = `<html><head>
  <meta property="og:image" content="https://img.itch.zone/cover.png" />
  <script type="application/ld+json">{"@type":"Product","name":"Your Happy Place","aggregateRating":{"@type":"AggregateRating","ratingValue":"4.5","ratingCount":22}}</script>
</head><body>
  <div class="game_info_panel_widget"><table><tbody>
    <tr><td>Updated</td><td><abbr title="30 July 2026 @ 12:17 UTC">2 days ago</abbr></td></tr>
    <tr><td>Published</td><td><abbr title="20 July 2026 @ 23:54 UTC">12 days ago</abbr></td></tr>
    <tr><td>Status</td><td><a href="#">Released</a></td></tr>
    <tr><td>Platforms</td><td>Windows, Linux</td></tr>
  </tbody></table></div>
  <div class="download_platforms">
    <span class="icon icon-windows8"></span>
    <span class="icon icon-tux"></span>
  </div>
</body></html>`;

describe("parseItchDetails", () => {
  const d = parseItchDetails(parse(ITCH_HTML));

  it("reads the clean product name from JSON-LD", () => {
    expect(d.title).toBe("Your Happy Place");
  });
  it("reads the dev status", () => {
    expect(d.dev_status).toBe("Released");
  });
  it("normalizes the Updated timestamp to ISO", () => {
    expect(d.updated_at).toBe("2026-07-30T12:17:00.000Z");
  });
  it("resolves platforms from download icons", () => {
    expect(d.platforms).toEqual(["Windows", "Linux"]);
  });
  it("reads the community rating value and count from JSON-LD", () => {
    expect(d.rating_value).toBe(4.5);
    expect(d.rating_count).toBe(22);
  });

  it("falls back to Published when a game was never updated", () => {
    const html = ITCH_HTML.replace(/<tr><td>Updated.*?<\/tr>/s, "");
    expect(parseItchDetails(parse(html)).updated_at).toBe(
      "2026-07-20T23:54:00.000Z",
    );
  });
  it("falls back to a 'Release date' row (established pages)", () => {
    const html = `<html><body><div class="game_info_panel_widget"><table><tbody>
      <tr><td>Release date</td><td><abbr title="01 April 2022 @ 02:45 UTC">Apr 01, 2022</abbr></td></tr>
    </tbody></table></div></body></html>`;
    expect(parseItchDetails(parse(html)).updated_at).toBe(
      "2022-04-01T02:45:00.000Z",
    );
  });
  it("maps an HTML5 platform row to Web", () => {
    const html = `<html><body><div class="game_info_panel_widget"><table><tbody>
      <tr><td>Platforms</td><td>HTML5, Windows, Android</td></tr>
    </tbody></table></div></body></html>`;
    expect(parseItchDetails(parse(html)).platforms).toEqual([
      "Windows",
      "Android",
      "Web",
    ]);
  });
  it("uses the Platforms row when there are no download icons", () => {
    const html = ITCH_HTML.replace(/<div class="download_platforms">.*?<\/div>/s, "");
    expect(parseItchDetails(parse(html)).platforms).toEqual(["Windows", "Linux"]);
  });
  it("degrades to neutral values on a non-itch page", () => {
    const d = parseItchDetails(parse("<html><body>nope</body></html>"));
    expect(d).toEqual({
      title: null,
      platforms: [],
      dev_status: null,
      updated_at: null,
      rating_value: null,
      rating_count: null,
    });
  });
});

describe("latestRssDate", () => {
  it("reads the first pubDate as ISO", () => {
    const xml = `<rss><channel>
      <item><pubDate>Fri, 16 Oct 2020 01:35:49 GMT</pubDate></item>
      <item><pubDate>Sat, 13 Sep 2019 19:03:03 GMT</pubDate></item>
    </channel></rss>`;
    expect(latestRssDate(xml)).toBe("2020-10-16T01:35:49.000Z");
  });
  it("returns null with no pubDate or an unparseable one", () => {
    expect(latestRssDate("<rss></rss>")).toBeNull();
    expect(latestRssDate("<pubDate>not a date</pubDate>")).toBeNull();
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
    expect(r.platforms).toEqual([]);
    expect(r.dev_status).toBeNull();
  });

  it("layers itch.io game details onto the generic result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (u: string) => {
        if (u.includes("itch.io")) return { ok: true, status: 200, text: async () => ITCH_HTML };
        return { ok: false, status: 404 }; // cover image → default focal
      }),
    );
    const r = await enrich("https://dev.itch.io/game");
    expect(r.title).toBe("Your Happy Place"); // clean name, not "<title>"
    expect(r.image_url).toBe("https://img.itch.zone/cover.png");
    expect(r.store).toBe("itch.io");
    expect(r.dev_status).toBe("Released");
    expect(r.platforms).toEqual(["Windows", "Linux"]);
    expect(r.updated_at).toBe("2026-07-30T12:17:00.000Z");
  });
});

const scan = (html: string, base = "https://x.com/p") =>
  scanForProductImage(parse(html), base);

describe("scanForProductImage", () => {
  it("skips logos/nav/icons and picks the product image", () => {
    const html = `
      <img src="/logo.png" />
      <img src="https://cdn.x.com/nav/menu.png" />
      <img src="https://cdn.x.com/hi-res/prod_01.jpg?sw=800" />`;
    expect(scan(html)).toBe("https://cdn.x.com/hi-res/prod_01.jpg?sw=800");
  });
  it("resolves relative URLs against the page", () => {
    expect(scan(`<img src="/hi-res/c.jpg?w=900" />`)).toBe(
      "https://x.com/hi-res/c.jpg?w=900",
    );
  });
  it("reads data-src and the first srcset entry", () => {
    expect(scan(`<img data-src="https://cdn.x.com/large/a.jpg" />`)).toBe(
      "https://cdn.x.com/large/a.jpg",
    );
    expect(
      scan(
        `<img srcset="https://cdn.x.com/b.jpg?w=600 600w, https://cdn.x.com/b2.jpg 1200w" />`,
      ),
    ).toBe("https://cdn.x.com/b.jpg?w=600");
  });
  it("ignores data URIs / svgs and returns null when nothing qualifies", () => {
    expect(
      scan(`<img src="data:image/png;base64,xx" /><img src="/icon.svg" />`),
    ).toBeNull();
  });
  it("prefers the higher-scoring candidate", () => {
    const html = `
      <img src="https://cdn.x.com/small.jpg" />
      <img src="https://cdn.x.com/large/big.jpg?w=1200" />`;
    expect(scan(html)).toBe("https://cdn.x.com/large/big.jpg?w=1200");
  });
});

const ld = (obj: unknown) =>
  jsonLdImage(
    parse(
      `<script type="application/ld+json">${JSON.stringify(obj)}</script>`,
    ),
  );

describe("jsonLdImage", () => {
  it("reads image as a string", () => {
    expect(ld({ image: "https://x.com/a.jpg" })).toBe("https://x.com/a.jpg");
  });
  it("reads the first of an image array", () => {
    expect(ld({ image: ["https://x.com/a.jpg", "https://x.com/b.jpg"] })).toBe(
      "https://x.com/a.jpg",
    );
  });
  it("reads image as an object with a url", () => {
    expect(ld({ image: { url: "https://x.com/c.jpg" } })).toBe(
      "https://x.com/c.jpg",
    );
  });
  it("finds an image nested in @graph", () => {
    expect(
      ld({ "@graph": [{ "@type": "Product", image: { url: "https://x.com/d.jpg" } }] }),
    ).toBe("https://x.com/d.jpg");
  });
  it("returns null with no image, and tolerates malformed JSON-LD", () => {
    expect(ld({ name: "nope" })).toBeNull();
    expect(
      jsonLdImage(parse(`<script type="application/ld+json">{ not json </script>`)),
    ).toBeNull();
  });
});
