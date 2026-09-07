"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { AnimeGroupCard } from "@/lib/db";
import { addAnimeGroup, editAnimeGroup, removeAnimeGroup } from "./actions";

type Props = { group: AnimeGroupCard | "new"; onClose: () => void };

export function GroupEditor({ group, onClose }: Props) {
  const isNew = group === "new";
  const existing = isNew ? null : group;

  const [name, setName] = useState(existing?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const firstRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
    if (!name.trim()) {
      setError("Enter a group name.");
      return;
    }
    const fields = { name: name.trim() };
    run(() =>
      isNew ? addAnimeGroup(fields) : editAnimeGroup(existing!.id, fields),
    );
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "Add group" : "Edit group"}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h2>{isNew ? "New group" : (existing!.name ?? "Edit group")}</h2>

        <div className="editor">
          <label className="editor-field">
            <span>Group name</span>
            <input
              ref={firstRef}
              type="text"
              placeholder="Monogatari Series"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <p className="editor-hint">
            The group&rsquo;s score is the average of its members (rounded down).
            Add anime from each title&rsquo;s edit dialog, and pick the cover from
            the group&rsquo;s page. Deleting a group keeps its anime — they return
            to the grid on their own.
          </p>

          {error && <p className="login-error">{error}</p>}

          <div className="editor-actions">
            <button className="btn primary" onClick={save} disabled={pending}>
              {pending ? "Saving…" : isNew ? "Create group" : "Save"}
            </button>
            {!isNew && (
              <button
                className="btn danger"
                onClick={() => {
                  if (confirm(`Delete the group "${existing!.name}"? Its anime stay.`))
                    run(() => removeAnimeGroup(existing!.id));
                }}
                disabled={pending}
              >
                Delete group
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
