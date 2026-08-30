// Shared visual vocabulary for the anime surface — score color, watch-status
// labels, genre pills, and the recommended-star icon. Mirrors games/marks.tsx
// but trimmed to what the anime cards need.

// Map a 0–10 score onto a red→amber→green hue (0 = red, 10 = green).
export function scoreColor(score: number): string {
  const hue = Math.max(0, Math.min(10, score)) * 12;
  return `hsl(${hue}, 65%, 48%)`;
}

// Personal watch-status → display label (values are the WatchStatus union).
export const STATUS_LABEL: Record<string, string> = {
  watching: "Watching",
  completed: "Completed",
  paused: "On hold",
  dropped: "Dropped",
  planned: "Plan to watch",
};

// Format code (AniList) → friendlier label.
export const FORMAT_LABEL: Record<string, string> = {
  TV: "TV",
  TV_SHORT: "TV Short",
  MOVIE: "Movie",
  SPECIAL: "Special",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "Music",
};

// One-line "TV · 25 eps · 2013" descriptor from the scraped fields.
export function formatMeta(a: {
  format: string | null;
  episodes: number | null;
  season_year: number | null;
}): string {
  const parts: string[] = [];
  if (a.format) parts.push(FORMAT_LABEL[a.format] ?? a.format);
  if (a.episodes) parts.push(`${a.episodes} ep${a.episodes === 1 ? "" : "s"}`);
  if (a.season_year) parts.push(String(a.season_year));
  return parts.join(" · ");
}

export const StarIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z" />
  </svg>
);
