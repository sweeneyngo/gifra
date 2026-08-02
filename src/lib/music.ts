import { sql } from "./db";
import { presign } from "./r2";

export interface Song {
  hashId: string;
  title: string;
  description: string | null;
  type: string;
  version: number;
  songGroupHashId: string | null;
  releasedAt: string | null;
  durationSec: number | null;
  genres: string[];
  statusTags: string[]; // e.g. "tentative" — status-type tags (ambiguity flag)
  singers: string[];
  artUrl: string | null; // presigned cover-art URL (24h)
  // Audio specs (for the info panel)
  audioFormat: string | null;
  bitrate: number | null; // kbps
  sampleRate: number | null; // Hz
  channels: number | null;
  bitsPerSample: number | null;
  lufs: number | null; // integrated loudness
}

interface Row {
  hash_id: string;
  title: string;
  description: string | null;
  type: string;
  version: number;
  song_group_hash_id: string | null;
  released_at: string | null;
  duration: number | null;
  art_key: string | null;
  audio_format: string | null;
  bitrate: number | null;
  sample_rate: number | null;
  channels: number | null;
  bits_per_sample: number | null;
  loudness_lufs: number | null;
  genres: string[] | null;
  status_tags: string[] | null;
  singers: string[] | null;
}

/** Full library, each song joined with its art/audio/genre/tag/singer info. */
export async function listSongs(): Promise<Song[]> {
  const rows = (await sql`
    select
      s.hash_id, s.title, s.description, s.type, s.version,
      s.song_group_hash_id, s.released_at,
      a.format_type as audio_format,
      am.duration, am.bitrate, am.sample_rate, am.channels,
      am.bits_per_sample, am.loudness_lufs,
      art.url as art_key,
      array(select g.name from music.song_genres sg
            join music.genres g on g.id = sg.genre_id
            where sg.song_id = s.id order by g.name) as genres,
      array(select t.name from music.song_tags st
            join music.tags t on t.id = st.tag_id
            where st.song_id = s.id and t.type = 'status'
            order by t.name) as status_tags,
      array(select si.name from music.song_singers ss
            join music.singers si on si.id = ss.singer_id
            where ss.song_id = s.id
            order by ss.role = 'main' desc, si.name) as singers
    from music.songs s
    left join lateral (
      select m.* from music.media_sources m
      where m.song_hash_id = s.hash_id and m.file_type = 'audio'
        and m.deleted_at is null
      order by m.created_at asc limit 1
    ) a on true
    left join music.audio_metadata am on am.media_source_id = a.id
    left join lateral (
      select m.url from music.media_sources m
      where m.song_hash_id = s.hash_id and m.file_type = 'art'
        and m.deleted_at is null
      order by m.created_at desc limit 1
    ) art on true
    where s.deleted_at is null
    order by s.title
  `) as Row[];

  // Presign cover art in parallel (24h; the library view is long-lived).
  return Promise.all(
    rows.map(async (r) => ({
      hashId: r.hash_id,
      title: r.title,
      description: r.description,
      type: r.type,
      version: r.version,
      songGroupHashId: r.song_group_hash_id,
      releasedAt: r.released_at ? new Date(r.released_at).toISOString() : null,
      durationSec: r.duration != null ? Number(r.duration) : null,
      genres: r.genres ?? [],
      statusTags: r.status_tags ?? [],
      singers: r.singers ?? [],
      artUrl: r.art_key ? await presign(r.art_key, 24 * 3600) : null,
      audioFormat: r.audio_format,
      bitrate: r.bitrate || null,
      sampleRate: r.sample_rate || null,
      channels: r.channels || null,
      bitsPerSample: r.bits_per_sample || null,
      lufs: r.loudness_lufs,
    })),
  );
}

/** R2 object key for a song's audio file (for streaming). */
export async function getAudioKey(hashId: string): Promise<string | null> {
  const rows = (await sql`
    select m.url
    from music.media_sources m
    where m.song_hash_id = ${hashId} and m.file_type = 'audio'
      and m.deleted_at is null
    order by m.created_at asc
    limit 1
  `) as { url: string }[];
  return rows[0]?.url ?? null;
}
