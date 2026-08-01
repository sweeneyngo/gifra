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
}

export async function listItems(): Promise<Item[]> {
  // Received items sink to the bottom; newest first within a group.
  return (await sql`
    select id, url, title, image_url, store, status, created_at
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
    returning id, url, title, image_url, store, status, created_at
  `) as Item[];
  return rows[0];
}

export async function setStatus(id: string, status: ItemStatus): Promise<void> {
  await sql`update items set status = ${status} where id = ${id}`;
}

export async function deleteItem(id: string): Promise<void> {
  await sql`delete from items where id = ${id}`;
}
