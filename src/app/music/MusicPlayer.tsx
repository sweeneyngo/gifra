"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Song } from "@/lib/music";

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MusicPlayer({ songs }: { songs: Song[] }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [idx, setIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(1);
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState<string | null>(null);

  const current = idx != null ? songs[idx] : null;

  const genres = useMemo(
    () => [...new Set(songs.flatMap((s) => s.genres))].sort(),
    [songs],
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return songs.filter((s) => {
      if (genre && !s.genres.includes(genre)) return false;
      if (!needle) return true;
      return (
        s.title.toLowerCase().includes(needle) ||
        s.singers.join(" ").toLowerCase().includes(needle)
      );
    });
  }, [songs, q, genre]);

  // Load + play whenever the selected track changes.
  useEffect(() => {
    const a = audioRef.current;
    if (!a || idx == null) return;
    a.src = `/api/music/songs/${songs[idx].hashId}/stream`;
    a.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    );
  }, [idx, songs]);

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = vol;
  }, [vol]);

  function playAt(i: number) {
    if (i === idx) {
      togglePlay();
    } else {
      setIdx(i);
    }
  }
  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  }
  function step(delta: number) {
    if (idx == null || songs.length === 0) return;
    setIdx((idx + delta + songs.length) % songs.length);
  }

  return (
    <div className="wrap music">
      <div className="music-head">
        <h1>Music</h1>
        <p className="sub">
          {songs.length} covers · sung by{" "}
          {[...new Set(songs.flatMap((s) => s.singers))].join(", ") || "—"}
        </p>
      </div>

      <div className="music-filters">
        <input
          className="music-search"
          placeholder="Search title or singer…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="genre-chips">
          <button
            className={`chip${genre === null ? " on" : ""}`}
            onClick={() => setGenre(null)}
          >
            All
          </button>
          {genres.map((g) => (
            <button
              key={g}
              className={`chip${genre === g ? " on" : ""}`}
              onClick={() => setGenre((cur) => (cur === g ? null : g))}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="tracklist">
        {shown.map((s) => {
          const realIdx = songs.indexOf(s);
          const isCurrent = realIdx === idx;
          return (
            <button
              key={s.hashId}
              className={`track${isCurrent ? " current" : ""}`}
              onClick={() => playAt(realIdx)}
            >
              <span className="track-art">
                {s.artUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.artUrl} alt="" loading="lazy" />
                ) : (
                  <span className="track-art empty">♪</span>
                )}
                <span className="track-play">
                  {isCurrent && playing ? <PauseIcon /> : <PlayIcon />}
                </span>
              </span>
              <span className="track-main">
                <span className="track-title">{s.title}</span>
                <span className="track-sub">{s.singers.join(", ")}</span>
              </span>
              <span className="track-genres">{s.genres.join(" · ")}</span>
              <span className="track-dur">
                {s.durationSec != null ? fmt(s.durationSec) : ""}
              </span>
            </button>
          );
        })}
        {shown.length === 0 && (
          <div className="empty-state">No songs match that.</div>
        )}
      </div>

      {/* Now-playing bar */}
      <div className={`nowplaying${current ? " show" : ""}`}>
        {current && (
          <>
            <div className="np-track">
              {current.artUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={current.artUrl} alt="" className="np-art" />
              )}
              <div className="np-meta">
                <div className="np-title">{current.title}</div>
                <div className="np-sub">{current.singers.join(", ")}</div>
              </div>
            </div>

            <div className="np-center">
              <div className="np-controls">
                <button onClick={() => step(-1)} aria-label="Previous">
                  <PrevIcon />
                </button>
                <button
                  className="np-play"
                  onClick={togglePlay}
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing ? <PauseIcon /> : <PlayIcon />}
                </button>
                <button onClick={() => step(1)} aria-label="Next">
                  <NextIcon />
                </button>
              </div>
              <div className="np-seek">
                <span>{fmt(time)}</span>
                <input
                  type="range"
                  min={0}
                  max={dur || 0}
                  step={0.1}
                  value={time}
                  onChange={(e) => {
                    const a = audioRef.current;
                    const v = Number(e.target.value);
                    if (a) a.currentTime = v;
                    setTime(v);
                  }}
                />
                <span>{fmt(dur)}</span>
              </div>
            </div>

            <div className="np-vol">
              <VolIcon />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={vol}
                onChange={(e) => setVol(Number(e.target.value))}
              />
            </div>
          </>
        )}
      </div>

      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onEnded={() => step(1)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
    </div>
  );
}

/* ---- icons ---- */
const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M8 5v14l11-7z" />
  </svg>
);
const PauseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
  </svg>
);
const PrevIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M7 6v12h2V6zm3 6 8.5 6V6z" />
  </svg>
);
const NextIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M15 6v12h2V6zM5.5 6v12L14 12z" />
  </svg>
);
const VolIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M4 9v6h3l4 4V5L7 9zm11 3a3 3 0 0 0-2-2.8v5.6A3 3 0 0 0 15 12z" />
  </svg>
);
