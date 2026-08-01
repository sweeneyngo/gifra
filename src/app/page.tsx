import { listItems } from "@/lib/db";
import { TopActions } from "./TopActions";

export const dynamic = "force-dynamic";

// Public-facing page title — rename freely.
const PAGE_TITLE = "My Wishlist";
const PAGE_SUBTITLE = "Things I'm after — pick anything that's not grayed out.";

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
      {/* Banner image lives at public/banner.jpg */}
      <header
        className="banner"
        style={{ backgroundImage: "url('/banner.jpg')" }}
      >
        <div className="banner-inner">
          <div className="banner-title">
            <h1>{PAGE_TITLE}</h1>
            <p>{PAGE_SUBTITLE}</p>
          </div>
          <TopActions />
        </div>
      </header>

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
                  >
                    no image
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
          <span className="tech">
            <IconNext /> Next.js
          </span>
          <span className="tech">
            <IconVercel /> Vercel
          </span>
          <span className="tech">
            <IconNeon /> Neon
          </span>
          <span className="tech">
            <IconDiscord /> Discord
          </span>
        </div>
      </footer>
    </div>
  );
}

/* ---- Inline monochrome stack icons (currentColor) ---- */
function IconNext() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M9 8v8M9 8l6.5 8.5M15 8v5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconVercel() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 3 22.5 21H1.5z" />
    </svg>
  );
}
function IconNeon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <ellipse
        cx="12"
        cy="6"
        rx="7"
        ry="3"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M5 6v12c0 1.66 3.13 3 7 3s7-1.34 7-3V6M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}
function IconDiscord() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.27 5.33A16.9 16.9 0 0 0 15.13 4l-.25.51a12.5 12.5 0 0 0-5.76 0L8.87 4a16.9 16.9 0 0 0-4.14 1.33C2.05 9.3 1.32 13.15 1.68 16.96a17 17 0 0 0 5.1 2.6c.41-.56.78-1.16 1.09-1.78-.6-.22-1.17-.5-1.72-.83l.42-.32a12.1 12.1 0 0 0 10.86 0l.43.32c-.55.33-1.13.6-1.72.83.31.62.68 1.22 1.09 1.78a17 17 0 0 0 5.1-2.6c.42-4.42-.72-8.23-3.49-11.63ZM8.55 14.65c-1.02 0-1.85-.92-1.85-2.05 0-1.13.81-2.05 1.85-2.05s1.87.93 1.85 2.05c0 1.13-.82 2.05-1.85 2.05Zm6.9 0c-1.02 0-1.85-.92-1.85-2.05 0-1.13.81-2.05 1.85-2.05s1.86.93 1.85 2.05c0 1.13-.82 2.05-1.85 2.05Z" />
    </svg>
  );
}
