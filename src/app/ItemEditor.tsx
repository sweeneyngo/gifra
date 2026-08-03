"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Item, ItemStatus } from "@/lib/db";
import { addItem, updateStatus, reenrichItem, removeItem } from "./actions";

const STATUS_OPTIONS: ItemStatus[] = ["wanted", "ordered", "received"];
const STATUS_LABEL: Record<ItemStatus, string> = {
  wanted: "Wanted",
  ordered: "Ordered",
  received: "Received",
};

type Props = { item: Item | "new"; onClose: () => void };

export function ItemEditor({ item, onClose }: Props) {
  const isNew = item === "new";
  const existing = isNew ? null : item;

  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<ItemStatus>(existing?.status ?? "wanted");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const firstRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
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
    if (isNew) {
      if (!/^https?:\/\//i.test(url.trim())) {
        setError("Enter a valid product URL.");
        return;
      }
      run(() => addItem(url.trim()));
    } else {
      run(() => updateStatus(existing!.id, status));
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "Add item" : "Edit item"}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h2>{isNew ? "Add an item" : (existing!.title ?? "Edit item")}</h2>

        <div className="editor">
          {isNew ? (
            <label className="editor-field">
              <span>Product URL</span>
              <input
                ref={firstRef as React.RefObject<HTMLInputElement>}
                type="url"
                placeholder="https://store.example.com/product"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </label>
          ) : (
            <>
              <div className="editor-url">{existing!.url}</div>
              <label className="editor-field">
                <span>Status</span>
                <select
                  ref={firstRef as React.RefObject<HTMLSelectElement>}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ItemStatus)}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {error && <p className="login-error">{error}</p>}

          <div className="editor-actions">
            <button className="btn primary" onClick={save} disabled={pending}>
              {pending ? "Saving…" : isNew ? "Add item" : "Save"}
            </button>
            {!isNew && (
              <>
                <button
                  className="btn"
                  onClick={() => run(() => reenrichItem(existing!.id, existing!.url), false)}
                  disabled={pending}
                  title="Re-scrape the title, image, and crop from the page"
                >
                  Re-enrich
                </button>
                <button
                  className="btn danger"
                  onClick={() => {
                    if (confirm(`Delete "${existing!.title ?? existing!.url}"?`))
                      run(() => removeItem(existing!.id));
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
