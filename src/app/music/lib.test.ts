import { describe, it, expect } from "vitest";
import { slugify, fmt, fmtDate, groupSongs } from "./lib";
import type { Song } from "@/lib/music";

const song = (over: Partial<Song>): Song => ({
  hashId: "h",
  title: "T",
  description: null,
  type: "cover",
  version: 1,
  songGroupHashId: null,
  releasedAt: null,
  durationSec: 100,
  genres: [],
  statusTags: [],
  singers: [],
  artUrl: null,
  audioFormat: "mp3",
  bitrate: 320,
  sampleRate: 44100,
  channels: 2,
  bitsPerSample: null,
  lufs: -10,
  ...over,
});

describe("slugify", () => {
  it("kebab-cases latin titles", () => {
    expect(slugify("BABEL")).toBe("babel");
    expect(slugify("Ayano's Theory of Happiness")).toBe(
      "ayanos-theory-of-happiness",
    );
    expect(slugify("Bake no Hana")).toBe("bake-no-hana");
  });
  it("returns empty for all-non-latin (caller falls back to the hash)", () => {
    expect(slugify("化けの花")).toBe("");
  });
});

describe("fmt", () => {
  it("formats seconds as m:ss", () => {
    expect(fmt(0)).toBe("0:00");
    expect(fmt(65)).toBe("1:05");
    expect(fmt(600)).toBe("10:00");
  });
  it("clamps invalid input", () => {
    expect(fmt(-5)).toBe("0:00");
    expect(fmt(NaN)).toBe("0:00");
  });
});

describe("fmtDate", () => {
  it("formats an ISO date (tz-tolerant)", () => {
    expect(fmtDate("2025-12-22T12:00:00.000Z")).toMatch(/Dec 22, 2025/);
  });
  it("returns empty for null", () => {
    expect(fmtDate(null)).toBe("");
  });
});

describe("groupSongs", () => {
  it("collapses versions, picks highest version as latest, sorts by publish desc", () => {
    const v1 = song({
      hashId: "a",
      title: "X",
      version: 1,
      songGroupHashId: "g",
      releasedAt: "2024-01-01T00:00:00.000Z",
    });
    const v2 = song({
      hashId: "b",
      title: "X",
      version: 2,
      songGroupHashId: "g",
      releasedAt: "2024-02-01T00:00:00.000Z",
    });
    const other = song({
      hashId: "c",
      title: "A",
      version: 1,
      songGroupHashId: "g2",
      releasedAt: "2025-01-01T00:00:00.000Z",
    });

    const groups = groupSongs([v1, v2, other]);
    expect(groups).toHaveLength(2);
    // "other" published latest → sorts first
    expect(groups[0].latest.hashId).toBe("c");

    const xg = groups.find((g) => g.key === "g")!;
    expect(xg.latest.hashId).toBe("b"); // highest version #
    expect(xg.versions.map((v) => v.version)).toEqual([2, 1]);
    expect(xg.publishedAt).toBe("2024-02-01T00:00:00.000Z");
  });

  it("uses hashId as the key when there is no group", () => {
    const s = song({ hashId: "solo", songGroupHashId: null });
    expect(groupSongs([s])[0].key).toBe("solo");
  });
});
