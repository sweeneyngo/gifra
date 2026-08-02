"use client";

import { useEffect, useState } from "react";
import type { Game } from "@/lib/db";
import { CoverArt } from "../CoverArt";
import {
  scoreColor,
  STATUS_LABEL,
  isUnderrated,
  isOverrated,
  parsePlatforms,
  PlatformIcons,
  StarIcon,
  GemIcon,
  OverIcon,
} from "./marks";

// "Jul 30, 2026" — compact, since it sits inside a card meta row.
const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

// The recommended / underrated / overrated markers shown beside a game's name.
function NameMarks({ game }: { game: Game }) {
  return (
    <>
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
      {isOverrated(game) && (
        <span className="overrated-star" title="Overrated" aria-label="Overrated">
          <OverIcon />
        </span>
      )}
    </>
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
          <NameMarks game={game} />
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
      <NameMarks game={game} />
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
