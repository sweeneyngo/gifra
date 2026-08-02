"use client";

import { useEffect, useRef, useState } from "react";

/** "What is this?" button + explainer modal for the FVN library. */
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
              I&apos;ve read, am reading, dropped, or plan to read. Each card
              links straight to the game on itch.io.
            </p>
            <p>
              The colored square and the <strong>/10</strong> are my own ranking
              (red = low, green = high), and the tag says where I&apos;m at with
              each one &mdash; Completed, In&nbsp;progress, Incomplete, Dropped,
              or Plan&nbsp;to&nbsp;read. Anything unrated is still on the pile.
            </p>
            <p>
              A gold star marks a personal pick (<strong>Recommended</strong>),
              and a gem marks an <strong>Underrated</strong> one &mdash; a game I
              rate highly that relatively few people have rated.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
