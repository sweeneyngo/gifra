// Measure integrated loudness (LUFS) + real bitrate for every track and store
// it, so playback can normalize to a target and show audio info.
// Fetches audio from the PUBLIC stream endpoint (no R2 creds needed).
//   node --env-file=.env.local scripts/music-loudness.mjs
import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const BASE = "https://www.gifra.me";
const CONCURRENCY = 4;
const sql = neon(process.env.DATABASE_URL);

await sql`alter table music.audio_metadata add column if not exists loudness_lufs double precision`;

const rows = await sql`
  select am.id as am_id, m.song_hash_id as hash
  from music.media_sources m
  join music.audio_metadata am on am.media_source_id = m.id
  where m.file_type = 'audio' and m.deleted_at is null
  order by am.id`;

console.log(`analyzing ${rows.length} tracks…`);
let done = 0;

async function analyze(row) {
  const tmp = `/tmp/gifra-loud-${row.am_id}.mp3`;
  try {
    const res = await fetch(`${BASE}/api/music/songs/${row.hash}/stream`);
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));

    // Integrated loudness via ebur128 (prints to stderr → merge with 2>&1).
    const out = execSync(
      `ffmpeg -hide_banner -i "${tmp}" -af ebur128 -f null - 2>&1`,
      { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
    );
    const matches = [...out.matchAll(/I:\s*(-?\d+(?:\.\d+)?)\s*LUFS/g)];
    const lufs = matches.length ? parseFloat(matches[matches.length - 1][1]) : null;

    // Real bitrate (kbps).
    const br = execSync(
      `ffprobe -v error -select_streams a:0 -show_entries stream=bit_rate -of default=nw=1:nk=1 "${tmp}"`,
      { encoding: "utf8" },
    ).trim();
    const kbps = br ? Math.round(parseInt(br, 10) / 1000) : null;

    await sql`update music.audio_metadata
      set loudness_lufs = ${lufs}, bitrate = ${kbps ?? 0}
      where id = ${row.am_id}`;
    done++;
    if (done % 10 === 0 || done === rows.length)
      console.log(`  ${done}/${rows.length}`);
  } catch (e) {
    console.log(`  ✗ ${row.hash}: ${String(e).split("\n")[0]}`);
  } finally {
    try { unlinkSync(tmp); } catch {}
  }
}

// Simple concurrency pool.
const queue = [...rows];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) await analyze(queue.shift());
  }),
);
console.log("✅ loudness pass complete.");
