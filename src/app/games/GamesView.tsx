"use client";

import { useEffect, useState } from "react";
import { siApple, siLinux, siAndroid, siHtml5 } from "simple-icons";
import type { Game } from "@/lib/db";
import { CoverArt } from "../CoverArt";

// simple-icons dropped the Windows mark (trademark); its logo is plain geometry,
// so inline the four-pane path in the same 24x24 solid-fill style.
const WINDOWS_PATH =
  "M0 3.449 9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699m10.949-8.099H24V24l-12.9-1.801";

// Supported-platform string -> icon. Unknown platforms fall back to a text pill.
const PLATFORM_ICON: Record<string, { path: string; title: string }> = {
  Windows: { path: WINDOWS_PATH, title: "Windows" },
  macOS: { path: siApple.path, title: "macOS" },
  Linux: { path: siLinux.path, title: "Linux" },
  Android: { path: siAndroid.path, title: "Android" },
  Web: { path: siHtml5.path, title: "Web (browser)" },
};

// Personal play-status → display label (values are the PlayStatus union).
const STATUS_LABEL: Record<string, string> = {
  completed: "Completed",
  "in-progress": "In progress",
  incomplete: "Incomplete",
  dropped: "Dropped",
  planned: "Plan to read",
};

// Map a 0–10 score onto a red→amber→green hue (0 = red, 10 = green).
function scoreColor(score: number): string {
  const hue = Math.max(0, Math.min(10, score)) * 12;
  return `hsl(${hue}, 65%, 48%)`;
}

// A game I rate highly (≥6) that relatively few people have rated (<1000):
// a hidden gem. itch community averages skew uniformly high, so the rating
// *count* is the discriminating "under-the-radar" signal, not the average.
const isUnderrated = (g: Game) =>
  g.score != null && g.score >= 6 && g.rating_count != null && g.rating_count < 1000;

const StarIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z" />
  </svg>
);

const GemIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M6 2h12l4 7-10 13L2 9z" />
  </svg>
);

// "Jul 30, 2026" — compact, since it sits inside a card meta row.
const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const parsePlatforms = (csv: string | null): string[] =>
  csv ? csv.split(",").map((p) => p.trim()).filter(Boolean) : [];

function PlatformIcons({ platforms }: { platforms: string[] }) {
  if (platforms.length === 0) return null;
  return (
    <div className="game-tags">
      {platforms.map((p) => {
        const icon = PLATFORM_ICON[p];
        return icon ? (
          <span key={p} className="plat" title={icon.title} aria-label={icon.title}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d={icon.path} />
            </svg>
          </span>
        ) : (
          <span key={p} className="pill">
            {p}
          </span>
        );
      })}
    </div>
  );
}

function GridCard({ game }: { game: Game }) {
  return (
    <div className="card">
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
          <span
            className="score-square"
            style={{ background: scoreColor(game.score) }}
            title={`My score: ${game.score}/10`}
          />
        )}
      </a>

      <div className="body">
        <div className="name-row">
          <a href={game.url} target="_blank" rel="noreferrer" className="name">
            {game.title ?? game.url}
          </a>
          {game.recommended && (
            <span className="rec-star" title="Recommended" aria-label="Recommended">
              <StarIcon />
            </span>
          )}
          {isUnderrated(game) && (
            <span className="underrated-star" title="Underrated" aria-label="Underrated">
              <GemIcon />
            </span>
          )}
        </div>

        <PlatformIcons platforms={parsePlatforms(game.platforms)} />

        <div className="meta-row">
          <div className="meta game-meta">
            {game.updated_at && (
              <span>Updated {dateFmt.format(new Date(game.updated_at))}</span>
            )}
            {game.status && (
              <span className={`play-status is-${game.status}`}>
                {STATUS_LABEL[game.status] ?? game.status}
              </span>
            )}
          </div>
          {game.score != null && (
            <span className="score-num" style={{ color: scoreColor(game.score) }}>
              {game.score}
              <span className="score-max">/10</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ListRow({ game }: { game: Game }) {
  return (
    <a href={game.url} target="_blank" rel="noreferrer" className="game-row">
      <span className="row-thumb">
        <CoverArt
          src={game.image_url}
          alt=""
          objectPosition={`${game.focal_x}% ${game.focal_y}%`}
          phSize="40%"
        />
      </span>
      <span className="row-name">{game.title ?? game.url}</span>
      {game.recommended && (
        <span className="rec-star" title="Recommended" aria-label="Recommended">
          <StarIcon />
        </span>
      )}
      {isUnderrated(game) && (
        <span className="underrated-star" title="Underrated" aria-label="Underrated">
          <GemIcon />
        </span>
      )}
      <PlatformIcons platforms={parsePlatforms(game.platforms)} />
      {game.status && (
        <span className={`play-status is-${game.status} row-status`}>
          {STATUS_LABEL[game.status] ?? game.status}
        </span>
      )}
      <span className="row-updated">
        {game.updated_at ? dateFmt.format(new Date(game.updated_at)) : ""}
      </span>
      {game.score != null && (
        <span className="row-score" style={{ color: scoreColor(game.score) }}>
          {game.score}
          <span className="score-max">/10</span>
        </span>
      )}
    </a>
  );
}

type View = "grid" | "list";
const VIEW_KEY = "gifra:games-view";

export function GamesView({ games }: { games: Game[] }) {
  // Start on "grid" for a stable first render, then adopt the saved choice.
  const [view, setView] = useState<View>("grid");
  useEffect(() => {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === "grid" || saved === "list") setView(saved);
  }, []);
  const choose = (v: View) => {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  };

  const rated = games.filter((g) => g.score != null).length;

  return (
    <>
      <div className="toolbar">
        <span className="count">
          {games.length} game{games.length === 1 ? "" : "s"}
          {rated > 0 && ` · ${rated} rated`}
        </span>
        <div className="view-toggle" role="group" aria-label="View">
          <button
            type="button"
            className={`view-btn${view === "grid" ? " active" : ""}`}
            onClick={() => choose("grid")}
            aria-pressed={view === "grid"}
            aria-label="Grid view"
            title="Grid view"
          >
            <GridIcon />
          </button>
          <button
            type="button"
            className={`view-btn${view === "list" ? " active" : ""}`}
            onClick={() => choose("list")}
            aria-pressed={view === "list"}
            aria-label="List view"
            title="List view"
          >
            <ListIcon />
          </button>
        </div>
      </div>

      {games.length === 0 ? (
        <div className="empty-state">No games imported yet.</div>
      ) : view === "grid" ? (
        <div className="grid">
          {games.map((game) => (
            <GridCard key={game.id} game={game} />
          ))}
        </div>
      ) : (
        <div className="game-list">
          {games.map((game) => (
            <ListRow key={game.id} game={game} />
          ))}
        </div>
      )}
    </>
  );
}

const GridIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
  </svg>
);

const ListIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden
  >
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <circle cx="3.5" cy="6" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="3.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="3.5" cy="18" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);
