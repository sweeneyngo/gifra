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
