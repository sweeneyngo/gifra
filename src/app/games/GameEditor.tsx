"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Game } from "@/lib/db";
import { STATUS_LABEL } from "./marks";
import { addGame, updateGame, reenrichGame, removeGame } from "./actions";

const STATUS_OPTIONS = [
  "completed",
  "in-progress",
  "incomplete",
  "dropped",
  "planned",
];

type Props = { game: Game | "new"; onClose: () => void };

export function GameEditor({ game, onClose }: Props) {
  const isNew = game === "new";
  const existing = isNew ? null : game;

  const [url, setUrl] = useState(existing?.url ?? "");
  const [score, setScore] = useState(
    existing?.score != null ? String(existing.score) : "",
  );
  const [status, setStatus] = useState(existing?.status ?? "");
  const [recommended, setRecommended] = useState(existing?.recommended ?? false);
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
  });

  // Run an action, surfacing any thrown error and closing on success.
  const run = (fn: () => Promise<void>, closeOnDone = true) =>
    start(async () => {
      setError(null);
      try {
        await fn();
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
      if (!/^https?:\/\//i.test(url.trim())) {
        setError("Enter a valid itch.io URL.");
        return;
      }
      run(() => addGame({ url: url.trim(), ...f }));
    } else {
      run(() => updateGame(existing!.id, f));
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "Add game" : "Edit game"}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h2>{isNew ? "Add a game" : (existing!.title ?? "Edit game")}</h2>

        <div className="editor">
          {isNew ? (
            <label className="editor-field">
              <span>itch.io URL</span>
              <input
                ref={firstRef as React.RefObject<HTMLInputElement>}
                type="url"
                placeholder="https://dev.itch.io/game"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
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

          {!isNew && existing!.slug && (
            <Link className="review-edit-link" href={`/games/${existing!.slug}/edit`}>
              {existing!.has_review ? "Edit review →" : "Write a review →"}
            </Link>
          )}

          {error && <p className="login-error">{error}</p>}

          <div className="editor-actions">
            <button className="btn primary" onClick={save} disabled={pending}>
              {pending ? "Saving…" : isNew ? "Add game" : "Save"}
            </button>
            {!isNew && (
              <>
                <button
                  className="btn"
                  onClick={() => run(() => reenrichGame(existing!.id, existing!.url), false)}
                  disabled={pending}
                  title="Re-scrape cover, platforms, rating, and update date from itch"
                >
                  Re-enrich
                </button>
                <button
                  className="btn danger"
                  onClick={() => {
                    if (confirm(`Delete "${existing!.title ?? existing!.url}"?`))
                      run(() => removeGame(existing!.id));
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
