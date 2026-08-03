/** Rough reading time in minutes (≥1) for a Markdown body, at ~200 wpm. */
export function readingTime(md: string): number {
  const words = md.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
