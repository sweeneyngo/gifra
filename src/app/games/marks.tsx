// Shared visual vocabulary for the FVN surface — score color, status labels,
// the recommended/underrated/overrated derivations, and the icon set. Imported
// by both the cards (GamesView) and the legend (FvnAbout) so they can't drift.
import { siApple, siLinux, siAndroid, siHtml5 } from "simple-icons";
import type { Game } from "@/lib/db";

// Map a 0–10 score onto a red→amber→green hue (0 = red, 10 = green).
export function scoreColor(score: number): string {
  const hue = Math.max(0, Math.min(10, score)) * 12;
  return `hsl(${hue}, 65%, 48%)`;
}

// Personal play-status → display label (values are the PlayStatus union).
export const STATUS_LABEL: Record<string, string> = {
  completed: "Completed",
  "in-progress": "In progress",
  incomplete: "Incomplete",
  dropped: "Dropped",
  planned: "Plan to read",
};

// itch community averages skew uniformly high, so the rating *count* is the
// discriminating signal, not the average.
// Underrated: a game I rate highly (≥6) that relatively few people rated (<1000).
export const isUnderrated = (g: Game) =>
  g.score != null && g.score >= 6 && g.rating_count != null && g.rating_count < 1000;
// Overrated: a game lots of people rate (≥1000) that I scored low (≤5).
export const isOverrated = (g: Game) =>
  g.score != null && g.score <= 5 && g.rating_count != null && g.rating_count >= 1000;

// simple-icons dropped the Windows mark (trademark); its logo is plain geometry,
// so inline the four-pane path in the same 24x24 solid-fill style.
const WINDOWS_PATH =
  "M0 3.449 9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699m10.949-8.099H24V24l-12.9-1.801";

// Supported-platform string -> icon. Unknown platforms fall back to a text pill.
export const PLATFORM_ICON: Record<string, { path: string; title: string }> = {
  Windows: { path: WINDOWS_PATH, title: "Windows" },
  macOS: { path: siApple.path, title: "macOS" },
  Linux: { path: siLinux.path, title: "Linux" },
  Android: { path: siAndroid.path, title: "Android" },
  Web: { path: siHtml5.path, title: "Web (browser)" },
};

export const parsePlatforms = (csv: string | null): string[] =>
  csv ? csv.split(",").map((p) => p.trim()).filter(Boolean) : [];

export function PlatformIcons({ platforms }: { platforms: string[] }) {
  if (platforms.length === 0) return null;
  return (
    <div className="game-tags">
      {platforms.map((p) => {
        const icon = PLATFORM_ICON[p];
        return icon ? (
          <span key={p} className="plat" title={icon.title} aria-label={icon.title}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d={icon.path} />
            </svg>
          </span>
        ) : (
          <span key={p} className="pill">
            {p}
          </span>
        );
      })}
    </div>
  );
}

export const StarIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z" />
  </svg>
);

export const GemIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M6 2h12l4 7-10 13L2 9z" />
  </svg>
);

// Trending-down arrow for "overrated".
export const OverIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M16 18l2.29-2.29-4.88-4.88-4 4L2 7.41 3.41 6l6 6 4-4 6.29 6.3L22 12v6z" />
  </svg>
);
