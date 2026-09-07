"use client";

// Reusable anime card + row, shared by the main grid (AnimeView) and a group's
// detail page (GroupDetail). Groups render their own card type; this file is
// only the single-anime presentation.
import type { Anime } from "@/lib/db";
import { CoverArt } from "../CoverArt";
import { EditButton } from "../EditButton";
import { scoreColor, STATUS_LABEL, formatMeta, StarIcon } from "./marks";

export type EditTarget = Anime | "new";

// Optional "set as group cover" control, shown on member cards on a group page.
export type CoverControl = { active: boolean; onToggle: () => void };

// The recommended marker shown beside an anime's title.
export function NameMarks({ anime }: { anime: Anime }) {
  return anime.recommended ? (
    <span className="rec-star" title="Recommended" aria-label="Recommended">
      <StarIcon />
    </span>
  ) : null;
}

const ImageIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="9" cy="9" r="1.6" />
    <path d="m21 15-4.5-4.5L5 21" />
  </svg>
);

// Toggle for making this anime the group's cover. Filled/accent when active.
function CoverButton({ active, onToggle }: CoverControl) {
  return (
    <button
      type="button"
      className={`cover-btn${active ? " active" : ""}`}
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? "Group cover (click to reset)" : "Set as group cover"}
      title={active ? "Group cover — click to reset to first-added" : "Set as group cover"}
    >
      <ImageIcon />
    </button>
  );
}

export function AnimeGridCard({
  anime,
  admin,
  onEdit,
  cover,
}: {
  anime: Anime;
  admin: boolean;
  onEdit: (t: EditTarget) => void;
  cover?: CoverControl;
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
          {cover && <CoverButton {...cover} />}
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

export function AnimeListRow({
  anime,
  admin,
  onEdit,
  cover,
}: {
  anime: Anime;
  admin: boolean;
  onEdit: (t: EditTarget) => void;
  cover?: CoverControl;
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
      {cover && <CoverButton {...cover} />}
      {admin && <EditButton onClick={() => onEdit(anime)} />}
    </div>
  );
}

// ---- View toggle (grid / list), shared so both surfaces stay in sync. ----

export type View = "grid" | "list";

export function ViewToggle({
  view,
  onChoose,
}: {
  view: View;
  onChoose: (v: View) => void;
}) {
  return (
    <div className="view-toggle" role="group" aria-label="View">
      <button
        type="button"
        className={`view-btn${view === "grid" ? " active" : ""}`}
        onClick={() => onChoose("grid")}
        aria-pressed={view === "grid"}
        aria-label="Grid view"
        title="Grid view"
      >
        <GridIcon />
      </button>
      <button
        type="button"
        className={`view-btn${view === "list" ? " active" : ""}`}
        onClick={() => onChoose("list")}
        aria-pressed={view === "list"}
        aria-label="List view"
        title="List view"
      >
        <ListIcon />
      </button>
    </div>
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
