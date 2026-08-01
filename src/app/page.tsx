import { listItems } from "@/lib/db";
import { updateStatus, removeItem } from "./actions";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export default async function Home() {
  const items = await listItems();

  return (
    <main className="wrap">
      <h1>gimme</h1>
      <p className="sub">
        Post a link with <code>/wishlist</code> in Discord, or it shows up here.
      </p>

      {items.length === 0 ? (
        <div className="empty-state">
          Nothing yet. Drop a <code>/wishlist &lt;link&gt;</code> in Discord.
        </div>
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
                    {item.store ? `${item.store} · ` : ""}
                    {dateFmt.format(new Date(item.created_at))}
                  </div>

                  <div className="actions">
                    {/* Toggle received on/off. */}
                    <form
                      action={async () => {
                        "use server";
                        await updateStatus(
                          item.id,
                          received ? "wanted" : "received",
                        );
                      }}
                    >
                      <button type="submit">
                        {received ? "↩ undo" : "✓ received"}
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await removeItem(item.id);
                      }}
                    >
                      <button type="submit">✕</button>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
