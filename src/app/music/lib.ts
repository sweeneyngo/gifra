import type { Song } from "@/lib/music";

export type { Song };

export interface Group {
  key: string;
  latest: Song; // highest version #
  versions: Song[]; // newest-version first
  publishedAt: string | null; // most recent release across versions
}

/** Collapse versions into groups, sorted by publish date (newest first). */
export function groupSongs(songs: Song[]): Group[] {
  const m = new Map<string, Song[]>();
  for (const s of songs) {
    const k = s.songGroupHashId || s.hashId;
    const arr = m.get(k);
    if (arr) arr.push(s);
    else m.set(k, [s]);
  }
  return [...m.values()]
    .map((vs) => {
      const sorted = [...vs].sort((a, b) => b.version - a.version);
      const publishedAt = vs.reduce<string | null>(
        (max, v) =>
          v.releasedAt && (!max || v.releasedAt > max) ? v.releasedAt : max,
        null,
      );
      return {
        key: sorted[0].songGroupHashId || sorted[0].hashId,
        latest: sorted[0],
        versions: sorted,
        publishedAt,
      };
    })
    .sort((a, b) => {
      if (a.publishedAt && b.publishedAt)
        return b.publishedAt.localeCompare(a.publishedAt);
      if (a.publishedAt) return -1;
      if (b.publishedAt) return 1;
      return a.latest.title.localeCompare(b.latest.title);
    });
}

export function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
