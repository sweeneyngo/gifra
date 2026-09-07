import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Neon's serverless driver speaks HTTP, so it works from Vercel functions
// without a persistent connection. Initialized lazily so `next build` doesn't
// fail when DATABASE_URL is absent from the build environment.
let _sql: NeonQueryFunction<false, false> | null = null;
export const sql: NeonQueryFunction<false, false> = new Proxy(
  (() => {}) as unknown as NeonQueryFunction<false, false>,
  {
    apply(_target, _thisArg, args) {
      if (!_sql) {
        if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
        _sql = neon(process.env.DATABASE_URL);
      }
      // @ts-expect-error — forward the tagged-template call verbatim.
      return _sql(...args);
    },
  },
);

export type ItemStatus = "wanted" | "ordered" | "received";

export interface Item {
  id: string;
  url: string;
  title: string | null;
  image_url: string | null;
  store: string | null;
  status: ItemStatus;
  created_at: string;
  focal_x: number; // visual-center crop, 0–100 (%)
  focal_y: number;
}

export async function listItems(): Promise<Item[]> {
  // Received items sink to the bottom; newest first within a group.
  return (await sql`
    select id, url, title, image_url, store, status, created_at, focal_x, focal_y
    from items
    order by (status = 'received'), created_at desc
  `) as Item[];
}

export async function insertItem(fields: {
  url: string;
  title: string | null;
  image_url: string | null;
  store: string | null;
}): Promise<Item> {
  const rows = (await sql`
    insert into items (url, title, image_url, store)
    values (${fields.url}, ${fields.title}, ${fields.image_url}, ${fields.store})
    returning id, url, title, image_url, store, status, created_at, focal_x, focal_y
  `) as Item[];
  return rows[0];
}

export async function setStatus(id: string, status: ItemStatus): Promise<void> {
  await sql`update items set status = ${status} where id = ${id}`;
}

export async function deleteItem(id: string): Promise<void> {
  await sql`delete from items where id = ${id}`;
}

/** Fill in title/image/focal once background enrichment finishes. */
export async function updateItemMeta(
  id: string,
  title: string | null,
  image_url: string | null,
  focal_x = 50,
  focal_y = 50,
): Promise<void> {
  await sql`
    update items
    set title = ${title}, image_url = ${image_url},
        focal_x = ${focal_x}, focal_y = ${focal_y}
    where id = ${id}
  `;
}

// ---- itch.io games surface ----

// Personal play-status. `planned` games are usually unrated.
export type PlayStatus =
  | "completed"
  | "in-progress"
  | "incomplete"
  | "dropped"
  | "planned";

export interface Game {
  id: string;
  url: string;
  title: string | null;
  image_url: string | null;
  score: number | null; // personal score, owner-set; null if unrated
  status: string | null; // personal play-status (PlayStatus)
  recommended: boolean; // owner-flagged pick
  dev_status: string | null; // itch's dev status, e.g. "Released"
  platforms: string | null; // comma-joined, e.g. "Windows, Linux"
  updated_at: string | null; // itch's last-update timestamp
  rating_value: number | null; // itch community average (out of 5)
  rating_count: number | null; // number of community ratings
  slug: string | null; // permalink for the review page
  has_review: boolean; // whether a review body exists (full body fetched separately)
  created_at: string;
  focal_x: number;
  focal_y: number;
}

/** A game plus its full review body — for the article page. */
export interface GameWithReview extends Game {
  review_md: string | null;
  review_title: string | null;
  review_updated_at: string | null;
}

export async function listGames(): Promise<Game[]> {
  // Highest personal score first (unrated — mostly planned — sink to the
  // bottom), then most recently updated on itch.
  return (await sql`
    select id, url, title, image_url, score, status, recommended, dev_status,
           platforms, updated_at, rating_value, rating_count,
           slug, (review_md is not null) as has_review,
           created_at, focal_x, focal_y
    from games
    order by score desc nulls last, updated_at desc nulls last
  `) as Game[];
}

/** Full game row incl. the review body, by permalink slug (null if none). */
export async function getGameBySlug(slug: string): Promise<GameWithReview | null> {
  const rows = (await sql`
    select id, url, title, image_url, score, status, recommended, dev_status,
           platforms, updated_at, rating_value, rating_count,
           slug, (review_md is not null) as has_review,
           review_md, review_title, review_updated_at,
           created_at, focal_x, focal_y
    from games
    where slug = ${slug}
  `) as GameWithReview[];
  return rows[0] ?? null;
}

/** Is a slug already taken? (used to keep generated slugs unique). */
export async function slugExists(slug: string): Promise<boolean> {
  const rows = (await sql`select 1 from games where slug = ${slug}`) as unknown[];
  return rows.length > 0;
}

export async function updateReview(
  id: string,
  fields: { title: string | null; md: string | null },
): Promise<void> {
  await sql`
    update games
    set review_title = ${fields.title}, review_md = ${fields.md},
        review_updated_at = now()
    where id = ${id}
  `;
}

export async function clearReview(id: string): Promise<void> {
  await sql`
    update games
    set review_md = null, review_title = null, review_updated_at = null
    where id = ${id}
  `;
}

/**
 * Insert or refresh a game by URL. The personal `score` is only written when a
 * value is supplied, so re-running enrichment never clobbers an existing score.
 */
export async function upsertGame(fields: {
  url: string;
  title: string | null;
  image_url: string | null;
  score: number | null;
  status: string | null;
  recommended?: boolean;
  dev_status: string | null;
  platforms: string | null;
  updated_at: string | null;
  rating_value: number | null;
  rating_count: number | null;
  slug?: string | null;
  focal_x?: number;
  focal_y?: number;
}): Promise<Game> {
  const rows = (await sql`
    insert into games
      (url, title, image_url, score, status, recommended, dev_status, platforms,
       updated_at, rating_value, rating_count, slug, focal_x, focal_y)
    values
      (${fields.url}, ${fields.title}, ${fields.image_url}, ${fields.score},
       ${fields.status}, ${fields.recommended ?? false}, ${fields.dev_status},
       ${fields.platforms}, ${fields.updated_at},
       ${fields.rating_value}, ${fields.rating_count}, ${fields.slug ?? null},
       ${fields.focal_x ?? 50}, ${fields.focal_y ?? 50})
    on conflict (url) do update set
      title        = excluded.title,
      image_url    = excluded.image_url,
      score        = coalesce(excluded.score, games.score),
      status       = coalesce(excluded.status, games.status),
      recommended  = excluded.recommended,
      dev_status   = excluded.dev_status,
      platforms    = excluded.platforms,
      updated_at   = excluded.updated_at,
      rating_value = excluded.rating_value,
      rating_count = excluded.rating_count,
      slug         = coalesce(games.slug, excluded.slug),
      focal_x      = excluded.focal_x,
      focal_y      = excluded.focal_y
    returning id, url, title, image_url, score, status, recommended, dev_status,
              platforms, updated_at, rating_value, rating_count,
              slug, (review_md is not null) as has_review,
              created_at, focal_x, focal_y
  `) as Game[];
  return rows[0];
}

/** Update just the owner-set fields (admin edit), leaving scraped data intact. */
export async function updateGameOwner(
  id: string,
  fields: { score: number | null; status: string | null; recommended: boolean },
): Promise<void> {
  await sql`
    update games
    set score = ${fields.score},
        status = ${fields.status},
        recommended = ${fields.recommended}
    where id = ${id}
  `;
}

/** Refresh just the scraped fields (admin re-enrich), leaving owner data intact. */
export async function updateGameScraped(
  id: string,
  fields: {
    title: string | null;
    image_url: string | null;
    platforms: string | null;
    dev_status: string | null;
    updated_at: string | null;
    rating_value: number | null;
    rating_count: number | null;
    focal_x: number;
    focal_y: number;
  },
): Promise<void> {
  await sql`
    update games
    set title = ${fields.title}, image_url = ${fields.image_url},
        platforms = ${fields.platforms}, dev_status = ${fields.dev_status},
        updated_at = ${fields.updated_at}, rating_value = ${fields.rating_value},
        rating_count = ${fields.rating_count},
        focal_x = ${fields.focal_x}, focal_y = ${fields.focal_y}
    where id = ${id}
  `;
}

export async function deleteGame(id: string): Promise<void> {
  await sql`delete from games where id = ${id}`;
}

// ---- AniList anime surface ----

// Personal watch-status. `planned` anime are usually unrated.
export type WatchStatus =
  | "watching"
  | "completed"
  | "paused"
  | "dropped"
  | "planned";

export interface Anime {
  id: string;
  url: string; // AniList siteUrl (unique key)
  title: string | null;
  image_url: string | null; // portrait cover (AniList extraLarge)
  score: number | null; // personal score, owner-set; null if unrated
  status: string | null; // personal watch-status (WatchStatus)
  recommended: boolean; // owner-flagged pick
  format: string | null; // AniList format, e.g. "TV", "Movie", "OVA"
  episodes: number | null;
  season_year: number | null;
  average_score: number | null; // AniList community average (0–100)
  genres: string | null; // comma-joined, e.g. "Action, Drama"
  cover_color: string | null; // AniList dominant cover color (hex)
  group_id: string | null; // owner-assigned group; null = shown standalone
  created_at: string;
  focal_x: number;
  focal_y: number;
}

/** Standalone anime for the main grid — group members are folded into their group. */
export async function listUngroupedAnime(): Promise<Anime[]> {
  return (await sql`
    select id, url, title, image_url, score, status, recommended, format,
           episodes, season_year, average_score, genres, cover_color, group_id,
           created_at, focal_x, focal_y
    from anime
    where group_id is null
    order by score desc nulls last, title asc nulls last
  `) as Anime[];
}

/**
 * Insert or refresh an anime by URL. The personal `score`/`status` are only
 * written when supplied, so re-enriching never clobbers owner data.
 */
export async function upsertAnime(fields: {
  url: string;
  title: string | null;
  image_url: string | null;
  score: number | null;
  status: string | null;
  recommended?: boolean;
  format: string | null;
  episodes: number | null;
  season_year: number | null;
  average_score: number | null;
  genres: string | null;
  cover_color: string | null;
  focal_x?: number;
  focal_y?: number;
}): Promise<Anime> {
  const rows = (await sql`
    insert into anime
      (url, title, image_url, score, status, recommended, format, episodes,
       season_year, average_score, genres, cover_color, focal_x, focal_y)
    values
      (${fields.url}, ${fields.title}, ${fields.image_url}, ${fields.score},
       ${fields.status}, ${fields.recommended ?? false}, ${fields.format},
       ${fields.episodes}, ${fields.season_year}, ${fields.average_score},
       ${fields.genres}, ${fields.cover_color},
       ${fields.focal_x ?? 50}, ${fields.focal_y ?? 50})
    on conflict (url) do update set
      title         = excluded.title,
      image_url     = excluded.image_url,
      score         = coalesce(excluded.score, anime.score),
      status        = coalesce(excluded.status, anime.status),
      recommended   = excluded.recommended,
      format        = excluded.format,
      episodes      = excluded.episodes,
      season_year   = excluded.season_year,
      average_score = excluded.average_score,
      genres        = excluded.genres,
      cover_color   = excluded.cover_color,
      focal_x       = excluded.focal_x,
      focal_y       = excluded.focal_y
    returning id, url, title, image_url, score, status, recommended, format,
              episodes, season_year, average_score, genres, cover_color, group_id,
              created_at, focal_x, focal_y
  `) as Anime[];
  return rows[0];
}

/** Update just the owner-set fields (admin edit), incl. group membership. */
export async function updateAnimeOwner(
  id: string,
  fields: {
    score: number | null;
    status: string | null;
    recommended: boolean;
    group_id: string | null;
  },
): Promise<void> {
  await sql`
    update anime
    set score = ${fields.score},
        status = ${fields.status},
        recommended = ${fields.recommended},
        group_id = ${fields.group_id}
    where id = ${id}
  `;
}

/** Refresh just the scraped fields (admin re-enrich), leaving owner data intact. */
export async function updateAnimeScraped(
  id: string,
  fields: {
    title: string | null;
    image_url: string | null;
    format: string | null;
    episodes: number | null;
    season_year: number | null;
    average_score: number | null;
    genres: string | null;
    cover_color: string | null;
    focal_x: number;
    focal_y: number;
  },
): Promise<void> {
  await sql`
    update anime
    set title = ${fields.title}, image_url = ${fields.image_url},
        format = ${fields.format}, episodes = ${fields.episodes},
        season_year = ${fields.season_year}, average_score = ${fields.average_score},
        genres = ${fields.genres}, cover_color = ${fields.cover_color},
        focal_x = ${fields.focal_x}, focal_y = ${fields.focal_y}
    where id = ${id}
  `;
}

export async function deleteAnime(id: string): Promise<void> {
  await sql`delete from anime where id = ${id}`;
}

// ---- Anime groups ----

/** A group's own row (owner-set name + separate score). */
export interface AnimeGroup {
  id: string;
  slug: string;
  name: string;
  score: number | null;
  created_at: string;
}

/** A group as it appears on the grid: its score plus the first member's cover. */
export interface AnimeGroupCard {
  id: string;
  slug: string;
  name: string;
  score: number | null;
  cover_url: string | null; // first-added member's poster
  cover_color: string | null;
  member_count: number;
}

// The main grid interleaves standalone anime with group cards, both sorted by
// score. A discriminated union keeps the two shapes distinct at the call site.
export type AnimeGridEntry =
  | { kind: "anime"; anime: Anime }
  | { kind: "group"; group: AnimeGroupCard };

/** Merge standalone anime + group cards into one score-sorted grid list. */
export function buildAnimeGrid(
  anime: Anime[],
  groups: AnimeGroupCard[],
): AnimeGridEntry[] {
  const entries: AnimeGridEntry[] = [
    ...anime.map((a) => ({ kind: "anime" as const, anime: a })),
    ...groups.map((g) => ({ kind: "group" as const, group: g })),
  ];
  const score = (e: AnimeGridEntry) =>
    e.kind === "anime" ? e.anime.score : e.group.score;
  // Highest score first; unrated sink to the bottom, keeping a stable order.
  return entries.sort((a, b) => (score(b) ?? -1) - (score(a) ?? -1));
}

/** For the main grid: every group with member count and representative cover. */
export async function listAnimeGroupCards(): Promise<AnimeGroupCard[]> {
  return (await sql`
    select g.id, g.slug, g.name, g.score,
           (select count(*)::int from anime a where a.group_id = g.id) as member_count,
           (select a.image_url from anime a where a.group_id = g.id
              order by a.created_at asc limit 1) as cover_url,
           (select a.cover_color from anime a where a.group_id = g.id
              order by a.created_at asc limit 1) as cover_color
    from anime_groups g
    order by g.score desc nulls last, g.name asc
  `) as AnimeGroupCard[];
}

/** {id, name} pairs for the group picker in the anime editor. */
export async function listAnimeGroupOptions(): Promise<
  { id: string; name: string }[]
> {
  return (await sql`
    select id, name from anime_groups order by name asc
  `) as { id: string; name: string }[];
}

/** A group plus its member anime (for the detail page), or null if unknown. */
export async function getAnimeGroupBySlug(
  slug: string,
): Promise<{ group: AnimeGroup; members: Anime[] } | null> {
  const groups = (await sql`
    select id, slug, name, score, created_at from anime_groups where slug = ${slug}
  `) as AnimeGroup[];
  const group = groups[0];
  if (!group) return null;
  const members = (await sql`
    select id, url, title, image_url, score, status, recommended, format,
           episodes, season_year, average_score, genres, cover_color, group_id,
           created_at, focal_x, focal_y
    from anime
    where group_id = ${group.id}
    order by score desc nulls last, season_year asc nulls last, created_at asc
  `) as Anime[];
  return { group, members };
}

export async function animeGroupSlugExists(slug: string): Promise<boolean> {
  const rows = (await sql`
    select 1 from anime_groups where slug = ${slug}
  `) as unknown[];
  return rows.length > 0;
}

export async function insertAnimeGroup(fields: {
  slug: string;
  name: string;
  score: number | null;
}): Promise<AnimeGroup> {
  const rows = (await sql`
    insert into anime_groups (slug, name, score)
    values (${fields.slug}, ${fields.name}, ${fields.score})
    returning id, slug, name, score, created_at
  `) as AnimeGroup[];
  return rows[0];
}

export async function updateAnimeGroup(
  id: string,
  fields: { name: string; score: number | null },
): Promise<void> {
  await sql`
    update anime_groups
    set name = ${fields.name}, score = ${fields.score}
    where id = ${id}
  `;
}

/** Delete a group; members are ungrouped automatically (FK on delete set null). */
export async function deleteAnimeGroup(id: string): Promise<void> {
  await sql`delete from anime_groups where id = ${id}`;
}

/** Fuzzy-find items by title / store / url for the owner manage commands. */
export async function findItemsByQuery(
  query: string,
  limit = 5,
): Promise<Item[]> {
  const q = `%${query}%`;
  return (await sql`
    select id, url, title, image_url, store, status, created_at, focal_x, focal_y
    from items
    where title ilike ${q} or store ilike ${q} or url ilike ${q}
    order by created_at desc
    limit ${limit}
  `) as Item[];
}
