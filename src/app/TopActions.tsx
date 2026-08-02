"use client";

import { useEffect, useRef, useState } from "react";

const CONTACT_EMAIL = "sweeneyngo@proton.me";

export function TopActions() {
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

      <a
        className="btn icon"
        href={`mailto:${CONTACT_EMAIL}`}
        aria-label="Email me"
        title={`Email ${CONTACT_EMAIL}`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      </a>

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
              A running wishlist of things I&apos;m after. Each card links
              straight to the product &mdash; if you&apos;re looking for a gift
              idea, anything here is fair game.
            </p>
            <p>
              Grayed-out items have already been received, so skip those. The
              list updates itself as I add things.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
