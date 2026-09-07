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
    slug         text unique,
    review_md    text,
    review_title text,
    review_updated_at timestamptz,
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
await sql`alter table games add column if not exists slug text`;
await sql`alter table games add column if not exists review_md text`;
await sql`alter table games add column if not exists review_title text`;
await sql`alter table games add column if not exists review_updated_at timestamptz`;
await sql`create unique index if not exists games_slug_key on games (slug)`;

console.log("✅ games table ready.");

// AniList anime surface: personal `score` and watch `status` are owner-set; the
// rest (cover, format, episodes, season, community average, genres) come from
// the AniList GraphQL API. Mirrors the `games` shape, minus itch/review fields.
await sql`
  create table if not exists anime (
    id            uuid primary key default gen_random_uuid(),
    url           text not null unique,
    title         text,
    image_url     text,
    score         real,
    status        text,
    recommended   boolean not null default false,
    format        text,
    episodes      integer,
    season_year   integer,
    average_score integer,
    genres        text,
    cover_color   text,
    created_at    timestamptz not null default now(),
    focal_x       real not null default 50,
    focal_y       real not null default 50
  )
`;

// Owner-defined groups: a named bucket with its own separate score that
// collapses several anime rows (e.g. a multi-season series) into one card on
// the grid. Membership is manual via `anime.group_id`; deleting a group
// ungroups its members (on delete set null) rather than removing the anime.
await sql`
  create table if not exists anime_groups (
    id         uuid primary key default gen_random_uuid(),
    slug       text not null unique,
    name       text not null,
    score      real,
    created_at timestamptz not null default now()
  )
`;
await sql`
  alter table anime add column if not exists group_id uuid
    references anime_groups(id) on delete set null
`;
await sql`create index if not exists anime_group_id_idx on anime (group_id)`;

console.log("✅ anime table ready.");

// wplace pixel-art progress tracking. A `project` is one drawing pinned to the
// canvas at a tile + in-tile offset; `template_png` is the palette-quantized
// target image (stored inline — these are tiny). Snapshots are a pure numeric
// time series the dashboard charts; no rendered images are persisted.
await sql`
  create table if not exists wplace_projects (
    id           uuid primary key default gen_random_uuid(),
    slug         text not null unique,
    title        text,
    tile_x       integer not null,
    tile_y       integer not null,
    offset_x     integer not null,
    offset_y     integer not null,
    width        integer not null,
    height       integer not null,
    template_png bytea not null,
    created_at   timestamptz not null default now()
  )
`;

// Optional attribution / provenance, added after the fact.
await sql`alter table wplace_projects add column if not exists author text`;
await sql`alter table wplace_projects add column if not exists source_url text`;

await sql`
  create table if not exists wplace_snapshots (
    id         uuid primary key default gen_random_uuid(),
    project_id uuid not null references wplace_projects(id) on delete cascade,
    taken_at   timestamptz not null default now(),
    total_px   integer not null,
    correct_px integer not null,
    wrong_px   integer not null,
    missing_px integer not null,
    percent    real not null
  )
`;
await sql`
  create index if not exists wplace_snapshots_project_time
  on wplace_snapshots (project_id, taken_at desc)
`;

console.log("✅ wplace tables ready.");
