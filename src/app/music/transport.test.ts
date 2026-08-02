import { describe, it, expect } from "vitest";
import { nextIndex, prevIndex, randomIndex } from "./transport";

describe("nextIndex", () => {
  it("advances sequentially mid-list", () => {
    expect(nextIndex(3, 0, "off", false)).toBe(1);
    expect(nextIndex(3, 1, "off", true)).toBe(2);
  });
  it("stops (null) at the end on auto-advance with no repeat", () => {
    expect(nextIndex(3, 2, "off", true)).toBeNull();
  });
  it("wraps to start at the end on a manual next with no repeat", () => {
    expect(nextIndex(3, 2, "off", false)).toBe(0);
  });
  it("wraps at the end when repeat=all (auto or manual)", () => {
    expect(nextIndex(3, 2, "all", true)).toBe(0);
    expect(nextIndex(3, 2, "all", false)).toBe(0);
  });
  it("returns null for an empty list", () => {
    expect(nextIndex(0, 0, "off", true)).toBeNull();
  });
});

describe("prevIndex", () => {
  it("steps back", () => {
    expect(prevIndex(3, 2)).toBe(1);
    expect(prevIndex(3, 1)).toBe(0);
  });
  it("wraps from the first to the last", () => {
    expect(prevIndex(3, 0)).toBe(2);
  });
});

describe("randomIndex", () => {
  it("never returns the excluded index", () => {
    // rand yields 0,0,0.9 — the two 0s would pick index 0 (excluded), so it
    // must keep drawing until it lands elsewhere.
    const seq = [0, 0, 0.9];
    let k = 0;
    const rand = () => seq[k++ % seq.length];
    expect(randomIndex(3, 0, rand)).not.toBe(0);
  });
  it("picks the requested bucket", () => {
    expect(randomIndex(4, 0, () => 0.5)).toBe(2); // floor(0.5*4)=2
  });
  it("returns 0 for single-item (or empty) lists", () => {
    expect(randomIndex(1, 0)).toBe(0);
    expect(randomIndex(1, -1)).toBe(0);
  });
});
