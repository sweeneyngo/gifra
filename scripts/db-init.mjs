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

// itch.io games surface: personal `score` and play `status` are set by the
// owner (via the import file); `dev_status`, `platforms`, and `updated_at` are
// scraped from the page.
await sql`
  create table if not exists games (
    id          uuid primary key default gen_random_uuid(),
    url         text not null unique,
    title       text,
    image_url   text,
    score       real,
    status      text,
    recommended boolean not null default false,
    dev_status  text,
    platforms   text,
    updated_at  timestamptz,
    rating_value real,
    rating_count integer,
    created_at  timestamptz not null default now(),
    focal_x     real not null default 50,
    focal_y     real not null default 50
  )
`;

// `create table if not exists` skips existing tables, so add newer columns
// explicitly for databases created before these fields existed.
await sql`alter table games add column if not exists recommended boolean not null default false`;
await sql`alter table games add column if not exists rating_value real`;
await sql`alter table games add column if not exists rating_count integer`;

console.log("✅ games table ready.");
