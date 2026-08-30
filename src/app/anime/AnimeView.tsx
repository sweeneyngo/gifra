"use client";

import { useEffect, useState } from "react";
import type { Anime } from "@/lib/db";
import { CoverArt } from "../CoverArt";
import { logout } from "../admin/actions";
import { EditButton } from "../EditButton";
import { AnimeEditor } from "./AnimeEditor";
import { scoreColor, STATUS_LABEL, formatMeta, StarIcon } from "./marks";

type EditTarget = Anime | "new";

// The recommended marker shown beside an anime's title.
function NameMarks({ anime }: { anime: Anime }) {
  return anime.recommended ? (
    <span className="rec-star" title="Recommended" aria-label="Recommended">
      <StarIcon />
    </span>
  ) : null;
}

function GridCard({
  anime,
  admin,
  onEdit,
}: {
  anime: Anime;
  admin: boolean;
  onEdit: (t: EditTarget) => void;
}) {
  return (
    <div className="card">
      <a
        href={anime.url}
        target="_blank"
        rel="noreferrer"
        className="thumb thumb-poster"
        aria-label={anime.title ?? "anime"}
      >
        <CoverArt src={anime.image_url} alt="" />
        {anime.score != null && (
          <span
            className="score-square"
            style={{ background: scoreColor(anime.score) }}
            title={`My score: ${anime.score}/10`}
          />
        )}
      </a>

      <div className="body">
        <div className="name-row">
          <a href={anime.url} target="_blank" rel="noreferrer" className="name">
            {anime.title ?? anime.url}
          </a>
          <NameMarks anime={anime} />
          {admin && <EditButton onClick={() => onEdit(anime)} />}
        </div>

        <div className="meta-row">
          <div className="meta game-meta">
            {formatMeta(anime) && <span>{formatMeta(anime)}</span>}
            {anime.status && (
              <span className={`play-status is-${anime.status}`}>
                {STATUS_LABEL[anime.status] ?? anime.status}
              </span>
            )}
          </div>
          {anime.score != null && (
            <span className="score-num" style={{ color: scoreColor(anime.score) }}>
              {anime.score}
              <span className="score-max">/10</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ListRow({
  anime,
  admin,
  onEdit,
}: {
  anime: Anime;
  admin: boolean;
  onEdit: (t: EditTarget) => void;
}) {
  const content = (
    <a href={anime.url} target="_blank" rel="noreferrer" className="game-row-link">
      <span className="row-thumb row-thumb-poster">
        <CoverArt src={anime.image_url} alt="" phSize="40%" />
      </span>
      <span className="row-name">{anime.title ?? anime.url}</span>
      <NameMarks anime={anime} />
      {anime.status && (
        <span className={`play-status is-${anime.status} row-status`}>
          {STATUS_LABEL[anime.status] ?? anime.status}
        </span>
      )}
      <span className="row-updated">{formatMeta(anime)}</span>
      {anime.score != null && (
        <span className="row-score" style={{ color: scoreColor(anime.score) }}>
          {anime.score}
          <span className="score-max">/10</span>
        </span>
      )}
    </a>
  );

  return (
    <div className="game-row">
      {content}
      {admin && <EditButton onClick={() => onEdit(anime)} />}
    </div>
  );
}

type View = "grid" | "list";
const VIEW_KEY = "gifra:anime-view";

export function AnimeView({ anime, admin }: { anime: Anime[]; admin: boolean }) {
  // Start on "grid" for a stable first render, then adopt the saved choice.
  const [view, setView] = useState<View>("grid");
  const [editing, setEditing] = useState<EditTarget | null>(null);
  useEffect(() => {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === "grid" || saved === "list") setView(saved);
  }, []);
  const choose = (v: View) => {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  };

  const rated = anime.filter((a) => a.score != null).length;

  return (
    <>
      <div className="toolbar">
        <span className="count">
          {anime.length} title{anime.length === 1 ? "" : "s"}
          {rated > 0 && ` · ${rated} rated`}
        </span>
        <div className="toolbar-actions">
          {admin && (
            <>
              <button
                type="button"
                className="btn primary"
                onClick={() => setEditing("new")}
              >
                + Add anime
              </button>
              <form action={logout}>
                <button type="submit" className="btn">
                  Log out
                </button>
              </form>
            </>
          )}
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
      </div>

      {anime.length === 0 ? (
        <div className="empty-state">No anime added yet.</div>
      ) : view === "grid" ? (
        <div className="grid grid-poster">
          {anime.map((a) => (
            <GridCard key={a.id} anime={a} admin={admin} onEdit={setEditing} />
          ))}
        </div>
      ) : (
        <div className="game-list">
          {anime.map((a) => (
            <ListRow key={a.id} anime={a} admin={admin} onEdit={setEditing} />
          ))}
        </div>
      )}

      {editing && <AnimeEditor anime={editing} onClose={() => setEditing(null)} />}
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
