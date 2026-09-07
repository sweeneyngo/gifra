"use client";

import { useEffect, useState } from "react";
import type { Anime } from "@/lib/db";
import { AnimeEditor } from "./AnimeEditor";
import {
  AnimeGridCard,
  AnimeListRow,
  ViewToggle,
  type EditTarget,
  type View,
} from "./AnimeCard";

const VIEW_KEY = "gifra:anime-view";

// Member list for a group's detail page. Reuses the anime cards, minus the
// group machinery — the only edit here is on individual member titles.
export function GroupDetail({
  members,
  groups,
  admin,
}: {
  members: Anime[];
  groups: { id: string; name: string }[];
  admin: boolean;
}) {
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

  return (
    <>
      <div className="toolbar">
        <span className="count">
          {members.length} season{members.length === 1 ? "" : "s"}
        </span>
        <div className="toolbar-actions">
          <ViewToggle view={view} onChoose={choose} />
        </div>
      </div>

      {members.length === 0 ? (
        <div className="empty-state">
          No anime in this group yet. Open a title&rsquo;s edit dialog and assign it
          here.
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-poster">
          {members.map((a) => (
            <AnimeGridCard key={a.id} anime={a} admin={admin} onEdit={setEditing} />
          ))}
        </div>
      ) : (
        <div className="game-list">
          {members.map((a) => (
            <AnimeListRow key={a.id} anime={a} admin={admin} onEdit={setEditing} />
          ))}
        </div>
      )}

      {editing && (
        <AnimeEditor
          anime={editing}
          groups={groups}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
