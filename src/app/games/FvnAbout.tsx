"use client";

import { useEffect, useRef, useState } from "react";
import {
  PLATFORM_ICON,
  STATUS_LABEL,
  StarIcon,
  GemIcon,
  OverIcon,
} from "./marks";

const STATUS_ORDER = [
  "completed",
  "in-progress",
  "incomplete",
  "dropped",
  "planned",
];

/** "What is this?" button + explainer/legend modal for the FVN library. */
export function FvnAbout() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus(); // return focus to the trigger
  };

  // On open: move focus into the dialog and close on Escape.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="top-actions">
      <button ref={triggerRef} className="btn" onClick={() => setOpen(true)}>
        What is this?
      </button>

      {open && (
        <div className="modal-backdrop" onClick={close}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="What is this?"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              ref={closeRef}
              className="modal-close"
              onClick={close}
              aria-label="Close"
            >
              ✕
            </button>
            <h2>What is this?</h2>
            <p>
              My personal log of furry visual novels (FVNs) &mdash; everything
              I&apos;ve read, am reading, dropped, or plan to read, with my own
              ranking of each. Every card links to the game on itch.io.
            </p>

            <div className="legend">
              <span className="legend-title">Legend</span>

              <div className="legend-row">
                <span className="legend-key">
                  <span className="score-bar" />
                </span>
                <span>
                  <strong>Score</strong> &mdash; my ranking out of 10, red (low)
                  → green (high)
                </span>
              </div>
              <div className="legend-row">
                <span className="legend-key rec-star">
                  <StarIcon />
                </span>
                <span>
                  <strong>Recommended</strong> &mdash; a personal pick
                </span>
              </div>
              <div className="legend-row">
                <span className="legend-key underrated-star">
                  <GemIcon />
                </span>
                <span>
                  <strong>Underrated</strong> &mdash; I rate it ≥6 but fewer than
                  1,000 people have
                </span>
              </div>
              <div className="legend-row">
                <span className="legend-key overrated-star">
                  <OverIcon />
                </span>
                <span>
                  <strong>Overrated</strong> &mdash; 1,000+ ratings, but I scored
                  it ≤5
                </span>
              </div>

              <div className="legend-row">
                <span className="legend-label">Status</span>
                <span className="legend-statuses">
                  {STATUS_ORDER.map((s) => (
                    <span key={s} className={`play-status is-${s}`}>
                      {STATUS_LABEL[s]}
                    </span>
                  ))}
                </span>
              </div>
              <div className="legend-row">
                <span className="legend-label">Platforms</span>
                <span className="legend-statuses">
                  {Object.entries(PLATFORM_ICON).map(([name, icon]) => (
                    <span key={name} className="legend-plat">
                      <span className="plat">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                          <path d={icon.path} />
                        </svg>
                      </span>
                      {name}
                    </span>
                  ))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
