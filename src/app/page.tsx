import { siNextdotjs, siVercel, siNeon, siDiscord } from "simple-icons";
import { listItems } from "@/lib/db";
import { TopActions } from "./TopActions";

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
      <header
        className="banner"
        style={{ backgroundImage: "url('/banner.jpg')" }}
      >
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
                {item.image_url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="thumb"
                    style={{ backgroundImage: `url("${item.image_url}")` }}
                    aria-label={item.title ?? "item"}
                  />
                ) : (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="thumb empty"
                    aria-label={item.title ?? "item"}
                  >
                    <PawIcon />
                  </a>
                )}

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

/* ---- Paw-print placeholder for items without an image ---- */
function PawIcon() {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <ellipse cx="6" cy="12.5" rx="1.9" ry="2.5" />
      <ellipse cx="9.7" cy="8.2" rx="2" ry="2.7" />
      <ellipse cx="14.3" cy="8.2" rx="2" ry="2.7" />
      <ellipse cx="18" cy="12.5" rx="1.9" ry="2.5" />
      <path d="M12 12.4c-2.9 0-5.2 2.3-5.2 4.8 0 1.9 1.5 3 3.3 3 1 0 1.5-.4 1.9-.4s.9.4 1.9.4c1.8 0 3.3-1.1 3.3-3 0-2.5-2.3-4.8-5.2-4.8z" />
    </svg>
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
