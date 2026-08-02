"use client";

import Link from "next/link";
import { useEffect } from "react";
import type { Song } from "@/lib/music";
import { usePlayer } from "@/app/player/PlayerProvider";
import { CoverArt } from "@/app/CoverArt";
import { Waveform } from "./Waveform";
import { type Group, fmt, fmtDate } from "../lib";

export function SongDetail({
  group,
  songs,
  waveforms,
}: {
  group: Group;
  songs: Song[];
  waveforms: Record<string, number[]>;
}) {
  const player = usePlayer();

  useEffect(() => {
    player.hydrate(songs);
  }, [songs, player]);
  useEffect(() => {
    player.playHash(group.latest.hashId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const head = group.latest; // group identity (title / art / description)
  const active =
    group.versions.find((v) => v.hashId === player.currentHash) ?? head;
  const playing = player.currentHash === active.hashId && player.playing;
  const peaks = waveforms[active.hashId] ?? waveforms[head.hashId] ?? [];

  return (
    <div className="wrap song-page">
      <div className="hline" />
      <Link href="/music" className="song-back">
        ← Music Library
      </Link>

      <div className="sc-layout">
        <div className="sc-hero-left">
          <div className="sc-top">
            <button
              className="sc-play"
              onClick={() => player.playHash(active.hashId)}
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause /> : <Play />}
            </button>
            <div className="sc-titles">
              <h1>{head.title}</h1>
              <div className="sc-artist">{head.singers.join(", ")}</div>
            </div>
            <div className="sc-meta">
              {head.releasedAt && <span>{fmtDate(head.releasedAt)}</span>}
              {head.genres[0] && (
                <span className="sc-tag"># {head.genres[0].toLowerCase()}</span>
              )}
            </div>
          </div>

          {peaks.length > 0 && (
            <Waveform
              peaks={peaks}
              hash={active.hashId}
              duration={active.durationSec}
            />
          )}
        </div>

        <div className="sc-cover">
          <CoverArt src={head.artUrl} alt={head.title} />
        </div>

        {head.description && <p className="song-desc">{head.description}</p>}

        {group.versions.length > 1 && (
          <div className="song-versions">
            <div className="setting-label">Versions</div>
            {group.versions.map((v, i) => (
              <button
                key={v.hashId}
                className={`version-row${v.hashId === player.currentHash ? " current" : ""}`}
                onClick={() => player.playHash(v.hashId)}
              >
                <span className="v-play">
                  {v.hashId === player.currentHash && player.playing
                    ? "⏸"
                    : "▶"}
                </span>
                <span className="v-num">
                  v{v.version}
                  {i === 0 && <em className="v-latest">latest</em>}
                </span>
                <span className="v-date">{fmtDate(v.releasedAt)}</span>
                <span className="v-dur">
                  {v.durationSec != null ? fmt(v.durationSec) : ""}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const Play = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M8 5v14l11-7z" />
  </svg>
);
const Pause = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
  </svg>
);
