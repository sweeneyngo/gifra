import { siNextdotjs, siVercel, siNeon, siDiscord } from "simple-icons";
import { listItems } from "@/lib/db";
import { TopActions } from "./TopActions";
import { CoverArt } from "./CoverArt";

export const dynamic = "force-dynamic";

// Public-facing page title — rename freely.
const PAGE_TITLE = "My Wishlist";
const OWNER_HANDLE = "ifuxyl";

// Full date: "August 1, 2026" (not "Aug 1").
const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

export default async function Home() {
  const items = await listItems();
  const remaining = items.filter((i) => i.status !== "received").length;

  return (
    <div className="wrap">
      <div className="hline" />

      {/* Banner image lives at public/banner.jpg */}
      <header className="banner">
        <CoverArt src="/banner.jpg" alt="" objectPosition="center 12%" phSize="64px" />
        <div className="banner-inner">
          <div className="banner-title">
            <span className="eyebrow">{OWNER_HANDLE}</span>
            <h1>{PAGE_TITLE}</h1>
          </div>
          <TopActions />
        </div>
      </header>

      <div className="hline" />

      <div className="toolbar">
        <span className="count">
          {items.length} item{items.length === 1 ? "" : "s"}
          {items.length > 0 && ` · ${remaining} still wanted`}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">Nothing here yet — check back soon.</div>
      ) : (
        <div className="grid">
          {items.map((item) => {
            const received = item.status === "received";
            return (
              <div
                key={item.id}
                className={`card${received ? " received" : ""}`}
              >
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="thumb"
                  aria-label={item.title ?? "item"}
                >
                  <CoverArt
                    src={item.image_url}
                    alt=""
                    objectPosition={`${item.focal_x}% ${item.focal_y}%`}
                  />
                </a>

                <div className="body">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="name"
                  >
                    {item.title ?? item.url}
                  </a>

                  <div className="meta">
                    {received && <span className="received-tag">Received · </span>}
                    {item.store ? `${item.store} · ` : ""}
                    {dateFmt.format(new Date(item.created_at))}
                  </div>

                  {item.title && (
                    <div className="compare">
                      <span className="compare-label">Deals</span>
                      <a
                        href={`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(item.title)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Shopping ↗
                      </a>
                      <a
                        href={`https://camelcamelcamel.com/search?sq=${encodeURIComponent(item.title)}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Amazon price history"
                      >
                        Camel ↗
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <footer className="footer">
        <div className="footer-row">
          <span className="footer-label">Credits</span>
          <span>
            Banner art by{" "}
            <a
              href="https://x.com/stoatallynate?lang=en"
              target="_blank"
              rel="noreferrer"
            >
              @stoatallynate
            </a>
          </span>
        </div>

        <div className="footer-row">
          <span className="footer-label">Built with</span>
          <span className="stack">
            <BrandLink icon={siNextdotjs} href="https://nextjs.org" />
            <span className="plus">+</span>
            <BrandLink icon={siVercel} href="https://vercel.com" />
            <span className="plus">+</span>
            <BrandLink icon={siNeon} href="https://neon.tech" />
            <span className="plus">+</span>
            <BrandLink icon={siDiscord} href="https://discord.com" />
          </span>
        </div>
      </footer>

      <div className="hline" />
    </div>
  );
}


/* ---- Official brand marks (simple-icons), icon-only + linked ---- */
function BrandLink({
  icon,
  href,
}: {
  icon: { path: string; title: string };
  href: string;
}) {
  return (
    <a
      className="brand"
      href={href}
      target="_blank"
      rel="noreferrer"
      title={icon.title}
      aria-label={icon.title}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d={icon.path} />
      </svg>
    </a>
  );
}
