"use client";

import { useEffect, useRef, useState } from "react";

// Annotated sample card explaining the surface. Static graphic — injected as raw
// SVG so we don't hand-convert every attribute to JSX. Colors mirror marks.tsx.
const LEGEND_SVG = `
<svg viewBox="0 0 442 212" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Annotated sample FVN card" width="100%" style="font-family:inherit">
  <defs><style>
    .lbl{fill:#e6e6e6;font-size:11px}
    .lead{stroke:rgba(255,255,255,.24);stroke-width:1;fill:none}
    .dot{fill:rgba(255,255,255,.34)}
    .mut{fill:rgba(255,255,255,.45)}
  </style></defs>
  <rect x="14" y="14" width="150" height="176" rx="10" fill="#202020" stroke="rgba(255,255,255,.09)"/>
  <rect x="14" y="14" width="150" height="92" rx="10" fill="#2b2b2b"/>
  <rect x="14" y="60" width="150" height="46" fill="#2b2b2b"/>
  <text x="89" y="62" text-anchor="middle" class="mut" font-size="10.5">cover art</text>
  <rect x="143" y="22" width="15" height="15" rx="3.5" fill="hsl(120,65%,48%)"/>
  <text x="24" y="128" fill="#fff" font-size="13" font-weight="600">Sample FVN</text>
  <g transform="translate(103,117) scale(.6)" fill="#d9a15f"><path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z"/></g>
  <g transform="translate(121,118) scale(.55)" fill="#9aa0ee"><path d="M6 2h12l4 7-10 13L2 9z"/></g>
  <g transform="translate(137,117) scale(.6)" fill="#d98787"><path d="M16 18l2.29-2.29-4.88-4.88-4 4L2 7.41 3.41 6l6 6 4-4 6.29 6.3L22 12v6z"/></g>
  <g transform="translate(24,138) scale(.56)" fill="rgba(255,255,255,.5)"><path d="M0 3.449 9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699m10.949-8.099H24V24l-12.9-1.801"/></g>
  <g transform="translate(44,138) scale(.56)" fill="rgba(255,255,255,.5)"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></g>
  <g transform="translate(64,137) scale(.56)" fill="rgba(255,255,255,.5)"><path d="M18.4395 5.5586c-.675 1.1664-1.352 2.3318-2.0274 3.498-.0366-.0155-.0742-.0286-.1113-.043-1.8249-.6957-3.484-.8-4.42-.787-1.8551.0185-3.3544.4643-4.2597.8203-.084-.1494-1.7526-3.021-2.0215-3.4864a1.1451 1.1451 0 0 0-.1406-.1914c-.3312-.364-.9054-.4859-1.379-.203-.475.282-.7136.9361-.3886 1.5019 1.9466 3.3696-.0966-.2158 1.9473 3.3593.0172.031-.4946.2642-1.3926 1.0177C2.8987 12.176.452 14.772 0 18.9902h24c-.119-1.1108-.3686-2.099-.7461-3.0683-.7438-1.9118-1.8435-3.2928-2.7402-4.1836a12.1048 12.1048 0 0 0-2.1309-1.6875c.6594-1.122 1.312-2.2559 1.9649-3.3848.2077-.3615.1886-.7956-.0079-1.1191a1.1001 1.1001 0 0 0-.8515-.5332c-.5225-.0536-.9392.3128-1.0488.5449zm-.0391 8.461c.3944.5926.324 1.3306-.1563 1.6503-.4799.3197-1.188.0985-1.582-.4941-.3944-.5927-.324-1.3307.1563-1.6504.4727-.315 1.1812-.1086 1.582.4941zM7.207 13.5273c.4803.3197.5506 1.0577.1563 1.6504-.394.5926-1.1038.8138-1.584.4941-.48-.3197-.5503-1.0577-.1563-1.6504.4008-.6021 1.1087-.8106 1.584-.4941z"/></g>
  <text x="24" y="164" class="mut" font-size="10.5">Updated Aug 1, 2026</text>
  <text x="24" y="180" fill="#6cc070" font-size="10.5" font-weight="600">Completed</text>
  <text x="156" y="180" text-anchor="end" fill="hsl(120,65%,48%)" font-size="12.5" font-weight="700">8<tspan fill="rgba(255,255,255,.45)" font-size="10" font-weight="500">/10</tspan></text>
  <path class="lead" d="M158,29 H188"/><circle class="dot" cx="188" cy="29" r="1.7"/>
  <text x="194" y="32" class="lbl"><tspan font-weight="600">Score</tspan> — my /10, red → green</text>
  <path class="lead" d="M164,58 H188"/><circle class="dot" cx="188" cy="58" r="1.7"/>
  <text x="194" y="61" class="lbl"><tspan font-weight="600">Cover art</tspan> from itch</text>
  <path class="lead" d="M150,122 H188"/><circle class="dot" cx="188" cy="122" r="1.7"/>
  <g transform="translate(196,112) scale(.6)" fill="#d9a15f"><path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z"/></g>
  <text x="212" y="121" class="lbl"><tspan font-weight="600">Recommended</tspan> — a personal pick</text>
  <g transform="translate(196,128) scale(.55)" fill="#9aa0ee"><path d="M6 2h12l4 7-10 13L2 9z"/></g>
  <text x="212" y="137" class="lbl"><tspan font-weight="600">Underrated</tspan> — I rate ≥6, &lt;1k ratings</text>
  <g transform="translate(196,144) scale(.6)" fill="#d98787"><path d="M16 18l2.29-2.29-4.88-4.88-4 4L2 7.41 3.41 6l6 6 4-4 6.29 6.3L22 12v6z"/></g>
  <text x="212" y="153" class="lbl"><tspan font-weight="600">Overrated</tspan> — ≥1k ratings, I rate ≤5</text>
  <path class="lead" d="M88,140 H164 V168 H188"/><circle class="dot" cx="188" cy="168" r="1.7"/>
  <text x="194" y="171" class="lbl"><tspan font-weight="600">Platforms</tspan></text>
  <path class="lead" d="M92,178 H188 V185"/><circle class="dot" cx="188" cy="185" r="1.7"/>
  <text x="194" y="188" class="lbl"><tspan font-weight="600">Play status</tspan> · last updated</text>
</svg>`;

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
              ranking of each. Every card links to the game on itch.io:
            </p>
            <div
              className="legend-figure"
              dangerouslySetInnerHTML={{ __html: LEGEND_SVG }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
