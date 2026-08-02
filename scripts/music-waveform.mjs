// Precompute waveform peaks (120 bars, normalized 0..1) per track for the
// SoundCloud-style scrubber. Fetches audio from the PUBLIC stream endpoint.
//   node --env-file=.env.local scripts/music-waveform.mjs
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const BASE = "https://www.gifra.me";
const BARS = 120;
const CONCURRENCY = 4;
const sql = neon(process.env.DATABASE_URL);

await sql`alter table music.audio_metadata add column if not exists waveform jsonb`;

const rows = await sql`
  select am.id as am_id, m.song_hash_id as hash
  from music.media_sources m
  join music.audio_metadata am on am.media_source_id = m.id
  where m.file_type = 'audio' and m.deleted_at is null
  order by am.id`;

console.log(`waveforms for ${rows.length} tracks…`);
let done = 0;

async function analyze(row) {
  const tmp = `/tmp/gifra-wave-${row.am_id}.mp3`;
  try {
    const res = await fetch(`${BASE}/api/music/songs/${row.hash}/stream`);
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));

    // Decode → raw 16-bit mono PCM @ 8kHz.
    const pcmBuf = execFileSync(
      "ffmpeg",
      ["-i", tmp, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"],
      { maxBuffer: 128 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] },
    );
    const pcm = new Int16Array(
      pcmBuf.buffer,
      pcmBuf.byteOffset,
      Math.floor(pcmBuf.length / 2),
    );

    const bucket = Math.max(1, Math.floor(pcm.length / BARS));
    const peaks = [];
    let max = 1;
    for (let i = 0; i < BARS; i++) {
      let m = 0;
      const start = i * bucket;
      for (let j = 0; j < bucket && start + j < pcm.length; j++) {
        const v = Math.abs(pcm[start + j]);
        if (v > m) m = v;
      }
      peaks.push(m);
      if (m > max) max = m;
    }
    const norm = peaks.map((p) => Math.round((p / max) * 1000) / 1000);

    await sql`update music.audio_metadata set waveform = ${JSON.stringify(norm)}
      where id = ${row.am_id}`;
    done++;
    if (done % 15 === 0 || done === rows.length)
      console.log(`  ${done}/${rows.length}`);
  } catch (e) {
    console.log(`  ✗ ${row.hash}: ${String(e).split("\n")[0]}`);
  } finally {
    try { unlinkSync(tmp); } catch {}
  }
}

const queue = [...rows];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) await analyze(queue.shift());
  }),
);
console.log("✅ waveform pass complete.");
