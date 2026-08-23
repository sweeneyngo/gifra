import { describe, it, expect } from "vitest";
import {
  diffPixels,
  deriveAlerts,
  idleSince,
  canvasLatLng,
  wplaceLink,
  type WplaceSnapshot,
} from "@/lib/wplace";

// Minimal snapshot factory — only the numeric fields the pure helpers read.
let seq = 0;
const snap = (o: Partial<WplaceSnapshot> & { correct_px: number; wrong_px: number }): WplaceSnapshot => ({
  id: String(seq++),
  project_id: "p",
  taken_at: new Date(Date.UTC(2026, 0, 1, 0, seq * 15)).toISOString(),
  total_px: 100,
  missing_px: 100 - o.correct_px - o.wrong_px,
  percent: o.correct_px,
  ...o,
});

// Build an RGBA buffer from a flat list of [r,g,b,a] tuples.
const rgba = (px: number[][]) => new Uint8Array(px.flat());

const RED = [255, 0, 0, 255];
const BLUE = [0, 0, 255, 255];
const BLANK = [0, 0, 0, 0]; // transparent — unpainted canvas / untracked template
const DEFACE = [0xde, 0xfa, 0xce, 255]; // Blue Marble "ignore" sentinel

describe("diffPixels", () => {
  it("counts a fully-painted template as 100%", () => {
    const t = rgba([RED, BLUE]);
    const l = rgba([RED, BLUE]);
    expect(diffPixels(t, l, 2, 1)).toMatchObject({
      total: 2,
      correct: 2,
      wrong: 0,
      missing: 0,
      percent: 100,
    });
  });

  it("classifies missing vs wrong vs correct", () => {
    const t = rgba([RED, RED, RED]);
    const l = rgba([RED, BLUE, BLANK]); // correct, griefed, not-yet-painted
    expect(diffPixels(t, l, 3, 1)).toMatchObject({
      total: 3,
      correct: 1,
      wrong: 1,
      missing: 1,
    });
    expect(diffPixels(t, l, 3, 1).percent).toBeCloseTo(33.33, 1);
  });

  it("ignores transparent and #deface template pixels", () => {
    const t = rgba([RED, BLANK, DEFACE]);
    const l = rgba([RED, RED, RED]);
    // Only the first pixel is tracked; the other two are outside the design.
    expect(diffPixels(t, l, 3, 1)).toMatchObject({
      total: 1,
      correct: 1,
      percent: 100,
    });
  });

  it("reports 0% (not NaN) when nothing is tracked", () => {
    const t = rgba([BLANK, BLANK]);
    const l = rgba([RED, BLUE]);
    expect(diffPixels(t, l, 2, 1)).toMatchObject({ total: 0, percent: 0 });
  });
});

describe("deriveAlerts", () => {
  const levels = (snaps: WplaceSnapshot[]) => deriveAlerts(snaps).map((a) => a.level);

  it("returns nothing for an empty series", () => {
    expect(deriveAlerts([])).toEqual([]);
  });

  it("flags a sharp jump in wrong pixels as vandalism", () => {
    const snaps = [snap({ correct_px: 50, wrong_px: 0 }), snap({ correct_px: 50, wrong_px: 12 })];
    expect(levels(snaps)).toContain("danger");
  });

  it("does not flag a tiny wrong-pixel wobble as vandalism", () => {
    const snaps = [snap({ correct_px: 50, wrong_px: 1 }), snap({ correct_px: 50, wrong_px: 2 })];
    expect(levels(snaps)).not.toContain("danger");
  });

  it("flags a sustained three-check climb in wrong pixels", () => {
    const snaps = [
      snap({ correct_px: 40, wrong_px: 1 }),
      snap({ correct_px: 40, wrong_px: 4 }),
      snap({ correct_px: 40, wrong_px: 8 }),
    ];
    expect(levels(snaps)).toContain("danger");
  });

  it("warns when finished pixels get overwritten", () => {
    const snaps = [snap({ correct_px: 80, wrong_px: 0 }), snap({ correct_px: 60, wrong_px: 0 })];
    expect(levels(snaps)).toContain("warn");
  });

  it("celebrates completion", () => {
    const snaps = [snap({ correct_px: 100, wrong_px: 0 })];
    expect(levels(snaps)).toContain("success");
  });

  it("marks progress as stalled when nothing changes", () => {
    const snaps = [
      snap({ correct_px: 50, wrong_px: 0 }),
      snap({ correct_px: 50, wrong_px: 0 }),
      snap({ correct_px: 50, wrong_px: 0 }),
      snap({ correct_px: 50, wrong_px: 0 }),
    ];
    expect(levels(snaps)).toContain("info");
  });
});

describe("idleSince", () => {
  it("needs at least two snapshots", () => {
    expect(idleSince([snap({ correct_px: 10, wrong_px: 0 })])).toBeNull();
  });

  it("reports one step when the latest check changed", () => {
    const snaps = [snap({ correct_px: 10, wrong_px: 0 }), snap({ correct_px: 20, wrong_px: 0 })];
    expect(idleSince(snaps)?.steps).toBe(1);
  });

  it("counts consecutive unchanged checks", () => {
    const snaps = [
      snap({ correct_px: 10, wrong_px: 0 }),
      snap({ correct_px: 20, wrong_px: 0 }),
      snap({ correct_px: 20, wrong_px: 0 }),
      snap({ correct_px: 20, wrong_px: 0 }),
    ];
    expect(idleSince(snaps)?.steps).toBe(3);
  });
});

describe("canvasLatLng / wplaceLink", () => {
  it("maps the canvas origin to the Web-Mercator top-left", () => {
    const { lat, lng } = canvasLatLng({ tile_x: 0, tile_y: 0, offset_x: 0, offset_y: 0 });
    expect(lng).toBeCloseTo(-180, 5);
    expect(lat).toBeCloseTo(85.0511, 3); // Web-Mercator max latitude
  });

  it("maps the canvas centre to (0,0)", () => {
    const { lat, lng } = canvasLatLng({ tile_x: 1024, tile_y: 1024, offset_x: 0, offset_y: 0 });
    expect(lng).toBeCloseTo(0, 5);
    expect(lat).toBeCloseTo(0, 5);
  });

  it("builds a wplace.live deep link with lat/lng/zoom", () => {
    const url = wplaceLink({ tile_x: 1024, tile_y: 1024, offset_x: 0, offset_y: 0 });
    expect(url).toMatch(/^https:\/\/wplace\.live\/\?lat=0\.000000&lng=0\.000000&zoom=14$/);
  });
});
