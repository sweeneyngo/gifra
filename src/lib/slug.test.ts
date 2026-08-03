import { describe, it, expect } from "vitest";
import { slugify, gameSlugBase, uniqueSlug } from "./slug";
import { readingTime } from "./reading";

describe("slugify", () => {
  it("lowercases, strips punctuation, hyphenates", () => {
    expect(slugify("Devil's Gambit")).toBe("devils-gambit");
    expect(slugify("Echo: Route 65")).toBe("echo-route-65");
    expect(slugify("  Multiple   Spaces_and_underscores ")).toBe(
      "multiple-spaces-and-underscores",
    );
  });
  it("returns empty for punctuation-only titles", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("gameSlugBase", () => {
  it("uses the title when it slugifies to something", () => {
    expect(gameSlugBase("Your Happy Place", "https://x.itch.io/yhp")).toBe(
      "your-happy-place",
    );
  });
  it("falls back to the itch URL's last path segment", () => {
    expect(gameSlugBase(null, "https://dev.itch.io/cool-game")).toBe("cool-game");
    expect(gameSlugBase("!!!", "https://dev.itch.io/cool-game")).toBe("cool-game");
  });
  it("degrades to 'game' on an unusable url", () => {
    expect(gameSlugBase(null, "not a url")).toBe("game");
  });
});

describe("uniqueSlug", () => {
  it("returns the base when free", async () => {
    expect(await uniqueSlug("echo", () => false)).toBe("echo");
  });
  it("appends the first free numeric suffix", async () => {
    const taken = new Set(["echo", "echo-2", "echo-3"]);
    expect(await uniqueSlug("echo", (s) => taken.has(s))).toBe("echo-4");
  });
  it("supports async predicates", async () => {
    const taken = new Set(["a"]);
    expect(await uniqueSlug("a", async (s) => taken.has(s))).toBe("a-2");
  });
});

describe("readingTime", () => {
  it("is at least 1 minute", () => {
    expect(readingTime("just a few words")).toBe(1);
  });
  it("scales at ~200 wpm", () => {
    expect(readingTime(Array(600).fill("word").join(" "))).toBe(3);
  });
});
