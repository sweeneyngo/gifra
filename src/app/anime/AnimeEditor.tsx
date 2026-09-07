"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Anime } from "@/lib/db";
import { STATUS_LABEL } from "./marks";
import {
  addAnime,
  updateAnime,
  reenrichAnime,
  removeAnime,
  type ActionResult,
} from "./actions";

const STATUS_OPTIONS = ["watching", "completed", "paused", "dropped", "planned"];

type Props = {
  anime: Anime | "new";
  groups: { id: string; name: string }[];
  onClose: () => void;
};

export function AnimeEditor({ anime, groups, onClose }: Props) {
  const isNew = anime === "new";
  const existing = isNew ? null : anime;

  const [query, setQuery] = useState("");
  const [score, setScore] = useState(
    existing?.score != null ? String(existing.score) : "",
  );
  const [status, setStatus] = useState(existing?.status ?? "");
  const [recommended, setRecommended] = useState(existing?.recommended ?? false);
  const [groupId, setGroupId] = useState(existing?.group_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const firstRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ownerFields = () => ({
    score: score.trim() === "" ? null : Number(score),
    status: status || null,
    recommended,
    group_id: groupId || null,
  });

  // Run an action, surfacing a returned or thrown error and closing on success.
  const run = (fn: () => Promise<ActionResult>, closeOnDone = true) =>
    start(async () => {
      setError(null);
      try {
        const res = await fn();
        if (!res.ok) {
          setError(res.error);
          return;
        }
        if (closeOnDone) onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });

  const save = () => {
    const f = ownerFields();
    if (f.score != null && (Number.isNaN(f.score) || f.score < 0 || f.score > 10)) {
      setError("Score must be between 0 and 10.");
      return;
    }
    if (isNew) {
      if (!query.trim()) {
        setError("Enter an AniList URL or a title to search.");
        return;
      }
      run(() => addAnime({ query: query.trim(), ...f }));
    } else {
      run(() => updateAnime(existing!.id, f));
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "Add anime" : "Edit anime"}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h2>{isNew ? "Add an anime" : (existing!.title ?? "Edit anime")}</h2>

        <div className="editor">
          {isNew ? (
            <label className="editor-field">
              <span>AniList URL or title</span>
              <input
                ref={firstRef as React.RefObject<HTMLInputElement>}
                type="text"
                placeholder="https://anilist.co/anime/16498  ·  or  ·  Attack on Titan"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          ) : (
            <div className="editor-url">{existing!.url}</div>
          )}

          <div className="editor-row">
            <label className="editor-field">
              <span>Score (0–10)</span>
              <input
                ref={isNew ? undefined : (firstRef as React.RefObject<HTMLInputElement>)}
                type="number"
                min={0}
                max={10}
                step={0.5}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="—"
              />
            </label>
            <label className="editor-field">
              <span>Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">— none —</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="editor-check">
            <input
              type="checkbox"
              checked={recommended}
              onChange={(e) => setRecommended(e.target.checked)}
            />
            <span>Recommended</span>
          </label>

          {groups.length > 0 && (
            <label className="editor-field">
              <span>Group</span>
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">— none (show on its own) —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {error && <p className="login-error">{error}</p>}

          <div className="editor-actions">
            <button className="btn primary" onClick={save} disabled={pending}>
              {pending ? "Saving…" : isNew ? "Add anime" : "Save"}
            </button>
            {!isNew && (
              <>
                <button
                  className="btn"
                  onClick={() => run(() => reenrichAnime(existing!.id, existing!.url), false)}
                  disabled={pending}
                  title="Re-fetch cover, format, episodes, and community score from AniList"
                >
                  Re-enrich
                </button>
                <button
                  className="btn danger"
                  onClick={() => {
                    if (confirm(`Delete "${existing!.title ?? existing!.url}"?`))
                      run(() => removeAnime(existing!.id));
                  }}
                  disabled={pending}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
