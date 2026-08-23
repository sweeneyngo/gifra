import { describe, it, expect } from "vitest";
import { diffPixels } from "@/lib/wplace";

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
