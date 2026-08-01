// One-time schema setup. Run: npm run db:init
// Reads DATABASE_URL from the environment (or .env.local via `node --env-file`).
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Try: node --env-file=.env.local scripts/db-init.mjs");
  process.exit(1);
}

const sql = neon(url);

await sql`
  create table if not exists items (
    id          uuid primary key default gen_random_uuid(),
    url         text not null,
    title       text,
    image_url   text,
    store       text,
    status      text not null default 'wanted',
    created_at  timestamptz not null default now(),
    focal_x     real not null default 50,
    focal_y     real not null default 50
  )
`;

console.log("✅ items table ready.");
