// One-off: give every existing game a permalink slug (rows added before the
// slug column existed). Fast — no network, just slugifies titles.
//
//   node --env-file=.env.local --experimental-strip-types scripts/games-backfill-slugs.ts
import { neon } from "@neondatabase/serverless";
import { gameSlugBase, uniqueSlug } from "../src/lib/slug.ts";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set (use --env-file=.env.local).");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

const existing = (await sql`select slug from games where slug is not null`) as {
  slug: string;
}[];
const taken = new Set(existing.map((r) => r.slug));

const rows = (await sql`
  select id, title, url from games where slug is null order by created_at
`) as { id: string; title: string | null; url: string }[];

let n = 0;
for (const r of rows) {
  const slug = await uniqueSlug(gameSlugBase(r.title, r.url), (s) => taken.has(s));
  taken.add(slug);
  await sql`update games set slug = ${slug} where id = ${r.id}`;
  console.log(`  ${slug}  <-  ${r.title ?? r.url}`);
  n++;
}
console.log(`✅ backfilled ${n} slug(s).`);
