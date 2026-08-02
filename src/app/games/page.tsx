import { listGames } from "@/lib/db";
import { CoverArt } from "../CoverArt";

export const dynamic = "force-dynamic";

const PAGE_TITLE = "My Games";
const OWNER_HANDLE = "ifuxyl";

// Personal play-status → display label (values are the PlayStatus union).
const STATUS_LABEL: Record<string, string> = {
  completed: "Completed",
  "in-progress": "In progress",
  incomplete: "Incomplete",
  dropped: "Dropped",
  planned: "Plan to read",
};

// "Jul 30, 2026" — compact, since it sits inside a card meta row.
const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function Games() {
  const games = await listGames();
  const rated = games.filter((g) => g.score != null).length;

  return (
    <div className="wrap">
      <div className="hline" />

      <header className="page-head">
        <span className="eyebrow">{OWNER_HANDLE}</span>
        <h1>{PAGE_TITLE}</h1>
      </header>

      <div className="hline" />

      <div className="toolbar">
        <span className="count">
          {games.length} game{games.length === 1 ? "" : "s"}
          {rated > 0 && ` · ${rated} rated`}
        </span>
      </div>

      {games.length === 0 ? (
        <div className="empty-state">No games imported yet.</div>
      ) : (
        <div className="grid">
          {games.map((game) => {
            const platforms = game.platforms
              ? game.platforms.split(",").map((p) => p.trim()).filter(Boolean)
              : [];
            return (
              <div key={game.id} className="card">
                <a
                  href={game.url}
                  target="_blank"
                  rel="noreferrer"
                  className="thumb"
                  aria-label={game.title ?? "game"}
                >
                  <CoverArt
                    src={game.image_url}
                    alt=""
                    objectPosition={`${game.focal_x}% ${game.focal_y}%`}
                  />
                  {game.score != null && (
                    <span className="score" title="My score">
                      {game.score}
                    </span>
                  )}
                </a>

                <div className="body">
                  <a
                    href={game.url}
                    target="_blank"
                    rel="noreferrer"
                    className="name"
                  >
                    {game.title ?? game.url}
                  </a>

                  {platforms.length > 0 && (
                    <div className="game-tags">
                      {platforms.map((p) => (
                        <span key={p} className="pill">
                          {p}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="meta-row">
                    <div className="meta">
                      {game.status && (
                        <span className={`play-status is-${game.status}`}>
                          {STATUS_LABEL[game.status] ?? game.status}
                        </span>
                      )}
                      {game.updated_at &&
                        `Updated ${dateFmt.format(new Date(game.updated_at))}`}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="hline" />
    </div>
  );
}
