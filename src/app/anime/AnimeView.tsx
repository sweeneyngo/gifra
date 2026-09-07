"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AnimeGridEntry, AnimeGroupCard } from "@/lib/db";
import { CoverArt } from "../CoverArt";
import { logout } from "../admin/actions";
import { EditButton } from "../EditButton";
import { AnimeEditor } from "./AnimeEditor";
import { GroupEditor } from "./GroupEditor";
import {
  AnimeGridCard,
  AnimeListRow,
  ViewToggle,
  type EditTarget,
  type View,
} from "./AnimeCard";
import { scoreColor } from "./marks";

const VIEW_KEY = "gifra:anime-view";

// Small "stacked layers" mark that flags a card as a group, not a single title.
const LayersIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 2 2 7l10 5 10-5-10-5Z" />
    <path d="m2 12 10 5 10-5" />
    <path d="m2 17 10 5 10-5" />
  </svg>
);

const seasons = (n: number) => `${n} season${n === 1 ? "" : "s"}`;

function GroupGridCard({
  group,
  admin,
  onEdit,
}: {
  group: AnimeGroupCard;
  admin: boolean;
  onEdit: (g: AnimeGroupCard) => void;
}) {
  return (
    <div className="card">
      <Link href={`/anime/${group.slug}`} className="thumb thumb-poster" aria-label={group.name}>
        <CoverArt src={group.cover_url} alt="" />
        <span className="group-badge" title={seasons(group.member_count)}>
          <LayersIcon />
          {group.member_count}
        </span>
        {group.score != null && (
          <span
            className="score-square"
            style={{ background: scoreColor(group.score) }}
            title={`My score: ${group.score}/10`}
          />
        )}
      </Link>

      <div className="body">
        <div className="name-row">
          <Link href={`/anime/${group.slug}`} className="name">
            {group.name}
          </Link>
          {admin && <EditButton onClick={() => onEdit(group)} />}
        </div>

        <div className="meta-row">
          <div className="meta game-meta">
            <span>{seasons(group.member_count)}</span>
          </div>
          {group.score != null && (
            <span className="score-num" style={{ color: scoreColor(group.score) }}>
              {group.score}
              <span className="score-max">/10</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function GroupListRow({
  group,
  admin,
  onEdit,
}: {
  group: AnimeGroupCard;
  admin: boolean;
  onEdit: (g: AnimeGroupCard) => void;
}) {
  return (
    <div className="game-row">
      <Link href={`/anime/${group.slug}`} className="game-row-link">
        <span className="row-thumb row-thumb-poster">
          <CoverArt src={group.cover_url} alt="" phSize="40%" />
        </span>
        <span className="row-name">{group.name}</span>
        <span className="group-tag" title="Group">
          <LayersIcon />
        </span>
        <span className="row-updated">{seasons(group.member_count)}</span>
        {group.score != null && (
          <span className="row-score" style={{ color: scoreColor(group.score) }}>
            {group.score}
            <span className="score-max">/10</span>
          </span>
        )}
      </Link>
      {admin && <EditButton onClick={() => onEdit(group)} />}
    </div>
  );
}

export function AnimeView({
  entries,
  groups,
  admin,
}: {
  entries: AnimeGridEntry[];
  groups: { id: string; name: string }[];
  admin: boolean;
}) {
  // Start on "grid" for a stable first render, then adopt the saved choice.
  const [view, setView] = useState<View>("grid");
  const [editingAnime, setEditingAnime] = useState<EditTarget | null>(null);
  const [editingGroup, setEditingGroup] = useState<AnimeGroupCard | "new" | null>(null);
  useEffect(() => {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === "grid" || saved === "list") setView(saved);
  }, []);
  const choose = (v: View) => {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  };

  const groupCount = entries.filter((e) => e.kind === "group").length;
  const titleCount = entries.length - groupCount;

  return (
    <>
      <div className="toolbar">
        <span className="count">
          {titleCount} title{titleCount === 1 ? "" : "s"}
          {groupCount > 0 && ` · ${groupCount} group${groupCount === 1 ? "" : "s"}`}
        </span>
        <div className="toolbar-actions">
          {admin && (
            <>
              <button
                type="button"
                className="btn primary"
                onClick={() => setEditingAnime("new")}
              >
                + Add anime
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setEditingGroup("new")}
              >
                + Add group
              </button>
              <form action={logout}>
                <button type="submit" className="btn">
                  Log out
                </button>
              </form>
            </>
          )}
          <ViewToggle view={view} onChoose={choose} />
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">No anime added yet.</div>
      ) : view === "grid" ? (
        <div className="grid grid-poster">
          {entries.map((e) =>
            e.kind === "anime" ? (
              <AnimeGridCard
                key={e.anime.id}
                anime={e.anime}
                admin={admin}
                onEdit={setEditingAnime}
              />
            ) : (
              <GroupGridCard
                key={e.group.id}
                group={e.group}
                admin={admin}
                onEdit={setEditingGroup}
              />
            ),
          )}
        </div>
      ) : (
        <div className="game-list">
          {entries.map((e) =>
            e.kind === "anime" ? (
              <AnimeListRow
                key={e.anime.id}
                anime={e.anime}
                admin={admin}
                onEdit={setEditingAnime}
              />
            ) : (
              <GroupListRow
                key={e.group.id}
                group={e.group}
                admin={admin}
                onEdit={setEditingGroup}
              />
            ),
          )}
        </div>
      )}

      {editingAnime && (
        <AnimeEditor
          anime={editingAnime}
          groups={groups}
          onClose={() => setEditingAnime(null)}
        />
      )}
      {editingGroup && (
        <GroupEditor group={editingGroup} onClose={() => setEditingGroup(null)} />
      )}
    </>
  );
}
