import type { WplaceSnapshot } from "@/lib/wplace";

// Static SVG line chart of completion over time — hand-rolled to avoid a chart
// dependency, in the same spirit as the music waveform. Y is fixed 0–100% so
// separate projects are visually comparable; X spans first→last snapshot.
const W = 640;
const H = 160;
const PAD = { top: 8, right: 8, bottom: 18, left: 28 };

export function ProgressChart({ snapshots }: { snapshots: WplaceSnapshot[] }) {
  if (snapshots.length < 2) {
    return <p className="wp-chart-empty">Not enough snapshots yet to chart.</p>;
  }

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const times = snapshots.map((s) => new Date(s.taken_at).getTime());
  const t0 = times[0];
  const span = times[times.length - 1] - t0 || 1;

  const x = (t: number) => PAD.left + ((t - t0) / span) * innerW;
  const y = (pct: number) => PAD.top + (1 - pct / 100) * innerH;

  const pts = snapshots.map((s, i) => `${x(times[i]).toFixed(1)},${y(s.percent).toFixed(1)}`);
  const line = `M ${pts.join(" L ")}`;
  const area = `M ${PAD.left},${PAD.top + innerH} L ${pts.join(" L ")} L ${PAD.left + innerW},${PAD.top + innerH} Z`;

  const gridY = [0, 25, 50, 75, 100];

  return (
    <svg
      className="wp-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Completion percentage over time"
      preserveAspectRatio="none"
    >
      {gridY.map((g) => (
        <g key={g}>
          <line
            x1={PAD.left}
            x2={PAD.left + innerW}
            y1={y(g)}
            y2={y(g)}
            stroke="var(--line)"
            strokeDasharray="2 3"
          />
          <text x={4} y={y(g) + 3} className="wp-chart-tick">
            {g}
          </text>
        </g>
      ))}
      <path d={area} fill="var(--accent)" opacity={0.12} />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}
