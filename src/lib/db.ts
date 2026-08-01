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
