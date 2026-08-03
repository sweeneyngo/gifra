"use client";

import { useState } from "react";
import type { Item } from "@/lib/db";
import { CoverArt } from "./CoverArt";
import { EditButton } from "./EditButton";
import { ItemEditor } from "./ItemEditor";
import { logout } from "./admin/actions";

type EditTarget = Item | "new";

// Full date: "August 1, 2026" (not "Aug 1").
const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

function ItemCard({
  item,
  admin,
  onEdit,
}: {
  item: Item;
  admin: boolean;
  onEdit: (t: EditTarget) => void;
}) {
  const received = item.status === "received";
  return (
    <div className={`card${received ? " received" : ""}`}>
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="thumb"
        aria-label={item.title ?? "item"}
      >
        <CoverArt
          src={item.image_url}
          alt=""
          objectPosition={`${item.focal_x}% ${item.focal_y}%`}
        />
      </a>

      <div className="body">
        <a href={item.url} target="_blank" rel="noreferrer" className="name">
          {item.title ?? item.url}
        </a>

        <div className="meta-row">
          <div className="meta">
            {received && <span className="received-tag">Received · </span>}
            {item.store ? `${item.store} · ` : ""}
            {dateFmt.format(new Date(item.created_at))}
          </div>
          <div className="row-actions">
            {item.title && (
              <a
                className="compare-btn"
                href={`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(item.title)}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Compare prices on Google Shopping"
                title="Compare prices on Google Shopping"
              >
                <TagIcon />
              </a>
            )}
            {admin && <EditButton onClick={() => onEdit(item)} />}
          </div>
        </div>
      </div>
    </div>
  );
}

export function WishlistView({ items, admin }: { items: Item[]; admin: boolean }) {
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const remaining = items.filter((i) => i.status !== "received").length;

  return (
    <>
      <div className="toolbar">
        <span className="count">
          {items.length} item{items.length === 1 ? "" : "s"}
          {items.length > 0 && ` · ${remaining} still wanted`}
        </span>
        {admin && (
          <div className="toolbar-actions">
            <button
              type="button"
              className="btn primary"
              onClick={() => setEditing("new")}
            >
              + Add item
            </button>
            <form action={logout}>
              <button type="submit" className="btn">
                Log out
              </button>
            </form>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="empty-state">Nothing here yet — check back soon.</div>
      ) : (
        <div className="grid">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} admin={admin} onEdit={setEditing} />
          ))}
        </div>
      )}

      {editing && <ItemEditor item={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

const TagIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L3 13V3h10z" />
    <circle cx="7.5" cy="7.5" r="1.5" />
  </svg>
);
