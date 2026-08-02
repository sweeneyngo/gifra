// Pure playback-transport decisions, split out of PlayerProvider so the
// shuffle/repeat/end-of-list branch matrix can be unit-tested.

export type Repeat = "off" | "all" | "one";

/**
 * Index of the next track for sequential playback.
 * Returns null to stop (reached the end on auto-advance with no repeat).
 * On manual "next" at the end with no repeat, wraps to the start.
 */
export function nextIndex(
  len: number,
  i: number,
  repeat: Repeat,
  auto: boolean,
): number | null {
  if (len === 0) return null;
  if (i + 1 < len) return i + 1;
  if (repeat === "all") return 0;
  return auto ? null : 0;
}

/** Index of the previous track, wrapping around. */
export function prevIndex(len: number, i: number): number {
  if (len <= 0) return 0;
  return (i - 1 + len) % len;
}

/** A random index that isn't `exclude`. `rand` is injectable for testing. */
export function randomIndex(
  len: number,
  exclude: number,
  rand: () => number = Math.random,
): number {
  if (len <= 1) return 0;
  let j = exclude;
  while (j === exclude) j = Math.floor(rand() * len);
  return j;
}
