// Batch-import itch.io games into the `games` table.
//
//   node --env-file=.env.local scripts/games-import.ts <file>
//
// <file> is JSON or CSV listing the games you own, your play-status, and score:
//   JSON: [{ "url": "https://dev.itch.io/game", "status": "completed", "score": 8.5 }, ...]
//   CSV : one "url,status,score" per line (a header row is optional; both extra
//         columns optional). Pass `title` in JSON to label games with no itch page.
//
// Each URL is enriched live (cover art, dev status, platforms, last-update),
// then upserted by URL — re-running refreshes the scraped fields while keeping
// the status/score already in the DB. Runs as plain TypeScript via Node's
// --experimental-strip-types so it reuses the app's own enrich()/db code.
import { readFileSync } from "node:fs";
import { enrich } from "../src/lib/enrich.ts";
import { upsertGame } from "../src/lib/db.ts";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node --env-file=.env.local scripts/games-import.ts <file.json|file.csv>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set (use --env-file=.env.local).");
  process.exit(1);
}

interface Entry {
  url: string;
  title: string | null; // optional owner-provided label (for non-itch games)
  status: string | null;
  score: number | null;
}

/** Parse the import file (JSON array or CSV) into rows. */
function parseEntries(raw: string): Entry[] {
  const text = raw.trim();
  if (text.startsWith("[")) {
    const arr = JSON.parse(text) as {
      url: string;
      title?: string | null;
      status?: string | null;
      score?: number | string | null;
    }[];
    return arr.map((r) => ({
      url: r.url,
      title: r.title?.trim() || null,
      status: toStatus(r.status),
      score: toScore(r.score),
    }));
  }
  // CSV: "url,status,score" — split on commas, but only the first three fields.
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [url = "", status, score] = line.split(",");
      return {
        url: url.trim(),
        title: null,
        status: toStatus(status),
        score: toScore(score),
      };
    })
    .filter((e) => /^https?:\/\//i.test(e.url)); // drops any header row
}

// Normalize the many ways a status might be written to the canonical set.
const STATUS_ALIASES: Record<string, string> = {
  completed: "completed",
  complete: "completed",
  done: "completed",
  "in-progress": "in-progress",
  "in progress": "in-progress",
  playing: "in-progress",
  reading: "in-progress",
  incomplete: "incomplete",
  paused: "incomplete",
  "on hold": "incomplete",
  dropped: "dropped",
  abandoned: "dropped",
  planned: "planned",
  "plan to read": "planned",
  "plan to play": "planned",
  backlog: "planned",
  wishlist: "planned",
};

function toStatus(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const key = v.trim().toLowerCase();
  return key ? (STATUS_ALIASES[key] ?? key) : null;
}

function toScore(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  // Accept "8/10" as well as a bare number.
  const n = Number(String(v).split("/")[0].trim());
  return Number.isFinite(n) ? n : null;
}

const entries = parseEntries(readFileSync(path, "utf8"));
if (entries.length === 0) {
  console.error("No usable URLs found in the file.");
  process.exit(1);
}

console.log(`Importing ${entries.length} game(s)…`);
let ok = 0;
for (const { url, title, status, score } of entries) {
  try {
    const data = await enrich(url);
    await upsertGame({
      url,
      title: data.title ?? title, // itch name wins; else the owner-provided label
      image_url: data.image_url,
      score,
      status,
      dev_status: data.dev_status,
      platforms: data.platforms.length ? data.platforms.join(", ") : null,
      updated_at: data.updated_at,
      focal_x: data.focal_x,
      focal_y: data.focal_y,
    });
    ok++;
    const tags = [
      status,
      data.platforms.join("/") || null,
      score != null ? `★${score}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    console.log(`  ✓ ${data.title ?? title ?? url}${tags ? `  (${tags})` : ""}`);
  } catch (err) {
    console.error(`  ✗ ${url} — ${String(err)}`);
  }
}

console.log(`✅ Imported ${ok}/${entries.length}.`);
