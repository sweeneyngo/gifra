"use client";

import { useEffect, useState } from "react";

const CONTACT_EMAIL = "sweeneyngo@proton.me";

export function TopActions() {
  const [open, setOpen] = useState(false);

  // Close on Escape while the modal is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="top-actions">
      <button className="btn" onClick={() => setOpen(true)}>
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
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="What is this?"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setOpen(false)}
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
            <p>
              Questions or want to coordinate?{" "}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
