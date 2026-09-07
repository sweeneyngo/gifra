// AniList enrichment for the anime surface. Unlike the itch scraper in
// enrich.ts, AniList exposes a clean public GraphQL API (no key required), so we
// query it directly rather than parsing HTML. Accepts either an anilist.co URL
// (queried by id) or a free-text title (queried by search, top match wins).

export interface EnrichedAnime {
  url: string; // canonical AniList siteUrl
  title: string | null; // English if present, else romaji
  image_url: string | null; // portrait cover (extraLarge)
  format: string | null; // "TV", "Movie", "OVA", …
  episodes: number | null;
  season_year: number | null;
  average_score: number | null; // community average, 0–100
  genres: string[]; // e.g. ["Action", "Drama"]
  cover_color: string | null; // dominant cover color (hex)
}

const ENDPOINT = "https://graphql.anilist.co";

// Shared selection set — same fields whether we look up by id or by search.
const MEDIA_FIELDS = `
  siteUrl
  title { romaji english }
  coverImage { extraLarge large color }
  format
  episodes
  seasonYear
  averageScore
  genres
`;

const BY_ID = `query ($id: Int) { Media(id: $id, type: ANIME) {${MEDIA_FIELDS}} }`;
const BY_SEARCH = `query ($search: String) { Media(search: $search, type: ANIME) {${MEDIA_FIELDS}} }`;

interface AniListMedia {
  siteUrl: string | null;
  title: { romaji: string | null; english: string | null } | null;
  coverImage: { extraLarge: string | null; large: string | null; color: string | null } | null;
  format: string | null;
  episodes: number | null;
  seasonYear: number | null;
  averageScore: number | null;
  genres: string[] | null;
}

/** Pull the numeric id out of an anilist.co/anime/<id>/… URL, else null. */
function anilistId(input: string): number | null {
  const m = input.match(/anilist\.co\/anime\/(\d+)/i);
  return m ? Number(m[1]) : null;
}

/**
 * Thrown when AniList itself can't be reached or refuses the request (network
 * error, timeout, or a non-OK status like their 403 "temporarily disabled").
 * Distinct from a successful response that simply has no match, so callers can
 * tell "the API is down" apart from "no such anime". The message is user-facing.
 */
export class AniListUnavailableError extends Error {
  constructor() {
    super("AniList is currently unavailable. Please try again in a bit.");
    this.name = "AniListUnavailableError";
  }
}

async function query(q: string, variables: Record<string, unknown>): Promise<AniListMedia | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: q, variables }),
      signal: controller.signal,
    });
  } catch {
    throw new AniListUnavailableError(); // network failure or timeout/abort
  } finally {
    clearTimeout(timeout);
  }
  // A non-OK status (403/429/5xx) means the API is down, not "no match".
  if (!res.ok) throw new AniListUnavailableError();
  let json: { data?: { Media?: AniListMedia | null } };
  try {
    json = (await res.json()) as { data?: { Media?: AniListMedia | null } };
  } catch {
    throw new AniListUnavailableError();
  }
  return json.data?.Media ?? null; // OK response — null here means genuine no-match
}

/**
 * Resolve an AniList URL or a title search to a normalized anime record.
 * Returns null when nothing matches (bad id, no search hit, or network error).
 */
export async function enrichAnime(input: string): Promise<EnrichedAnime | null> {
  const trimmed = input.trim();
  const id = anilistId(trimmed);
  const media = id
    ? await query(BY_ID, { id })
    : await query(BY_SEARCH, { search: trimmed });
  if (!media) return null;

  const title = media.title?.english || media.title?.romaji || null;
  return {
    url: media.siteUrl ?? trimmed,
    title,
    image_url: media.coverImage?.extraLarge ?? media.coverImage?.large ?? null,
    format: media.format ?? null,
    episodes: media.episodes ?? null,
    season_year: media.seasonYear ?? null,
    average_score: media.averageScore ?? null,
    genres: media.genres ?? [],
    cover_color: media.coverImage?.color ?? null,
  };
}
