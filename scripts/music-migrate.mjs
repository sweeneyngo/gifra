// One-time migration: eefu SQLite -> gifra Neon Postgres (schema "music").
// Usage: node --env-file=.env.local scripts/music-migrate.mjs <path-to-eefu.db>
import { execSync } from "node:child_process";
import { neon } from "@neondatabase/serverless";

const dbPath = process.argv[2];
if (!dbPath) {
  console.error("Pass the path to eefu.db as an argument.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set (use --env-file=.env.local).");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

// neon()'s http driver only exposes the tagged-template interface in this
// version. A tagged-template call is just sql(strings, ...values), so we build
// the "strings" array (with a .raw) ourselves to run dynamic queries.
function tsa(parts) {
  const a = parts.slice();
  a.raw = parts.slice();
  return a;
}
const runRaw = (text) => sql(tsa([text]));
function insertParts(dst, cols) {
  const colList = cols.map((c) => `"${c}"`).join(", ");
  const parts = [`insert into music.${dst} (${colList}) values (`];
  for (let i = 1; i < cols.length; i++) parts.push(", ");
  parts.push(")");
  return tsa(parts);
}

// Read a SQLite table as JSON via the sqlite3 CLI.
function read(table) {
  const out = execSync(`sqlite3 -json "${dbPath}" "select * from ${table};"`, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
  return out ? JSON.parse(out) : [];
}

const DDL = [
  `drop schema if exists music cascade`,
  `create schema music`,
  `create table music.genres (
     id bigint primary key, name text not null,
     created_at timestamptz, updated_at timestamptz, deleted_at timestamptz)`,
  `create table music.tags (
     id bigint primary key, name text not null, type text not null default 'custom',
     description text, created_at timestamptz, updated_at timestamptz, deleted_at timestamptz)`,
  `create table music.singers (
     id bigint primary key, name text not null,
     created_at timestamptz, updated_at timestamptz, deleted_at timestamptz)`,
  `create table music.singer_aliases (
     id bigint primary key, singer_id bigint not null references music.singers(id) on delete cascade,
     name text not null, language text,
     created_at timestamptz, updated_at timestamptz, deleted_at timestamptz)`,
  `create table music.songs (
     id bigint primary key, hash_id text not null unique, title text not null,
     description text, type text not null, original_song_id bigint, version integer default 1,
     released_at timestamptz, song_group_hash_id text,
     created_at timestamptz, updated_at timestamptz, deleted_at timestamptz)`,
  `create index on music.songs (song_group_hash_id)`,
  `create table music.song_aliases (
     id bigint primary key, song_id bigint not null references music.songs(id) on delete cascade,
     name text not null, language text,
     created_at timestamptz, updated_at timestamptz, deleted_at timestamptz)`,
  `create table music.song_tags (
     song_id bigint not null references music.songs(id) on delete cascade,
     tag_id bigint not null references music.tags(id) on delete cascade,
     primary key (song_id, tag_id))`,
  `create table music.song_genres (
     song_id bigint not null references music.songs(id) on delete cascade,
     genre_id bigint not null references music.genres(id) on delete cascade,
     primary key (song_id, genre_id))`,
  `create table music.song_singers (
     id bigint primary key, song_id bigint not null references music.songs(id) on delete cascade,
     singer_id bigint not null references music.singers(id) on delete cascade, role text not null,
     created_at timestamptz, updated_at timestamptz, deleted_at timestamptz)`,
  `create table music.media_sources (
     id bigint primary key, song_hash_id text not null references music.songs(hash_id) on delete cascade,
     storage_type text not null, url text not null, file_type text default 'audio',
     format_type text not null, checksum text,
     created_at timestamptz, updated_at timestamptz, deleted_at timestamptz)`,
  `create index on music.media_sources (song_hash_id)`,
  `create table music.audio_metadata (
     id bigint primary key, media_source_id bigint references music.media_sources(id) on delete cascade,
     bitrate integer, sample_rate integer, channels integer, bits_per_sample integer, duration double precision,
     created_at timestamptz, updated_at timestamptz, deleted_at timestamptz)`,
  `create table music.image_metadata (
     media_source_id bigint references music.media_sources(id) on delete cascade,
     width integer, height integer)`,
];

// (src table, dst table, columns) — insertion order respects FKs.
const TABLES = [
  ["genres", "genres", ["id", "name", "created_at", "updated_at", "deleted_at"]],
  ["tags", "tags", ["id", "name", "type", "description", "created_at", "updated_at", "deleted_at"]],
  ["singers", "singers", ["id", "name", "created_at", "updated_at", "deleted_at"]],
  ["singer_aliases", "singer_aliases", ["id", "singer_id", "name", "language", "created_at", "updated_at", "deleted_at"]],
  ["songs", "songs", ["id", "hash_id", "title", "description", "type", "original_song_id", "version", "released_at", "song_group_hash_id", "created_at", "updated_at", "deleted_at"]],
  ["song_aliases", "song_aliases", ["id", "song_id", "name", "language", "created_at", "updated_at", "deleted_at"]],
  ["song_tags", "song_tags", ["song_id", "tag_id"]],
  ["song_genres", "song_genres", ["song_id", "genre_id"]],
  ["song_singers", "song_singers", ["id", "song_id", "singer_id", "role", "created_at", "updated_at", "deleted_at"]],
  ["media_sources", "media_sources", ["id", "song_hash_id", "storage_type", "url", "file_type", "format_type", "checksum", "created_at", "updated_at", "deleted_at"]],
  ["audio_metadata", "audio_metadata", ["id", "media_source_id", "bitrate", "sample_rate", "channels", "bits_per_sample", "duration", "created_at", "updated_at", "deleted_at"]],
  ["image_metadata", "image_metadata", ["media_source_id", "width", "height"]],
];

console.log("Creating schema…");
for (const stmt of DDL) await runRaw(stmt);

for (const [src, dst, cols] of TABLES) {
  const rows = read(src);
  const parts = insertParts(dst, cols);
  let n = 0;
  for (const r of rows) {
    const values = cols.map((c) => (r[c] === undefined ? null : r[c]));
    await sql(parts, ...values);
    n++;
  }
  console.log(`  ${dst}: ${n}`);
}

console.log("✅ migration complete.");
