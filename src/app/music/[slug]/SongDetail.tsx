"use client";

import Link from "next/link";
import { useEffect } from "react";
import type { Song } from "@/lib/music";
import { usePlayer } from "@/app/player/PlayerProvider";
import { CoverArt } from "@/app/CoverArt";
import { type Group, fmt, fmtDate } from "../lib";

export function SongDetail({
  group,
  songs,
}: {
  group: Group;
  songs: Song[];
}) {
  const player = usePlayer();
  const s = group.latest;

  // Load the full library into the player, then best-effort auto-play this track
  // (browsers may block autoplay without a gesture — the Play button covers that).
  useEffect(() => {
    player.hydrate(songs);
  }, [songs, player]);
  useEffect(() => {
    player.playHash(s.hashId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPlaying = (hash: string) =>
    player.currentHash === hash && player.playing;

  return (
    <div className="wrap song-page">
      <div className="hline" />
      <Link href="/music" className="song-back">
        ← Music Library
      </Link>

      <div className="song-hero">
        <div className="song-cover">
          <CoverArt src={s.artUrl} alt={s.title} />
        </div>
        <div className="song-info">
          <h1>{s.title}</h1>
          <div className="song-singers">{s.singers.join(", ")}</div>
          {s.genres.length > 0 && (
            <div className="song-genres">{s.genres.join(" · ")}</div>
          )}
          <div className="song-facts">
            {s.durationSec != null && <span>{fmt(s.durationSec)}</span>}
            {s.releasedAt && <span>{fmtDate(s.releasedAt)}</span>}
            {group.versions.length > 1 && (
              <span>{group.versions.length} versions</span>
            )}
          </div>
          <button
            className="song-play"
            onClick={() => player.playHash(s.hashId)}
          >
            {isPlaying(s.hashId) ? "⏸ Pause" : "▶ Play"}
          </button>
        </div>
      </div>

      {s.description && <p className="song-desc">{s.description}</p>}

      {group.versions.length > 1 && (
        <div className="song-versions">
          <div className="setting-label">Versions</div>
          {group.versions.map((v, i) => (
            <button
              key={v.hashId}
              className={`version-row${v.hashId === player.currentHash ? " current" : ""}`}
              onClick={() => player.playHash(v.hashId)}
            >
              <span className="v-play">{isPlaying(v.hashId) ? "⏸" : "▶"}</span>
              <span className="v-num">v{v.version}</span>
              {i === 0 && <span className="v-latest">latest</span>}
              <span className="v-date">{fmtDate(v.releasedAt)}</span>
              <span className="v-dur">
                {v.durationSec != null ? fmt(v.durationSec) : ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
