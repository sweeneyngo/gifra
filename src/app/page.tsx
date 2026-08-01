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
        <span className="banner-credit">Art by @stoatallynate</span>
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
    </div>
  );
}
