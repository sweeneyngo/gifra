// Permalink-slug helpers for game review pages. `slugify` mirrors the music
// lib's; kept here so lib/scripts don't import app code.
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

/** Slug candidate for a game: from its title, falling back to the itch URL path. */
export function gameSlugBase(title: string | null, url: string): string {
  const fromTitle = title ? slugify(title) : "";
  if (fromTitle) return fromTitle;
  try {
    const seg = new URL(url).pathname.split("/").filter(Boolean).pop();
    return seg ? slugify(seg) : "game";
  } catch {
    return "game";
  }
}

/**
 * Given a candidate base and a "taken?" predicate, return the base or the first
 * free "-2", "-3"… variant. Deterministic and injectable so it's easy to test
 * and to reuse for both live inserts (DB check) and batch backfills (in-memory).
 */
export async function uniqueSlug(
  base: string,
  taken: (slug: string) => boolean | Promise<boolean>,
): Promise<string> {
  if (!(await taken(base))) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!(await taken(candidate))) return candidate;
  }
}
