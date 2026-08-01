"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Song } from "@/lib/music";

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface Group {
  key: string;
  latest: Song; // highest version #
  versions: Song[]; // sorted newest-version first
}

export function MusicPlayer({ songs }: { songs: Song[] }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentHash, setCurrentHash] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(1);
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const byHash = useMemo(
    () => new Map(songs.map((s) => [s.hashId, s])),
    [songs],
  );
  const current = currentHash ? (byHash.get(currentHash) ?? null) : null;

  // Collapse versions into groups (latest = highest version number).
  const groups = useMemo<Group[]>(() => {
    const m = new Map<string, Song[]>();
    for (const s of songs) {
      const k = s.songGroupHashId || s.hashId;
      const arr = m.get(k);
      if (arr) arr.push(s);
      else m.set(k, [s]);
    }
    return [...m.values()]
      .map((vs) => {
        const sorted = [...vs].sort((a, b) => b.version - a.version);
        return {
          key: sorted[0].songGroupHashId || sorted[0].hashId,
          latest: sorted[0],
          versions: sorted,
        };
      })
      .sort((a, b) => a.latest.title.localeCompare(b.latest.title));
  }, [songs]);

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return groups;
    return groups.filter(
      (g) =>
        g.latest.title.toLowerCase().includes(n) ||
        g.latest.singers.join(" ").toLowerCase().includes(n),
    );
  }, [groups, q]);

  const order = useMemo(() => shown.map((g) => g.latest.hashId), [shown]);
  const groupOf = (hash: string) =>
    groups.find((g) => g.versions.some((v) => v.hashId === hash));

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !currentHash) return;
    a.src = `/api/music/songs/${currentHash}/stream`;
    a.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    );
  }, [currentHash]);

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = vol;
  }, [vol]);

  function playHash(h: string) {
    if (h === currentHash) togglePlay();
    else setCurrentHash(h);
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
    if (!currentHash || order.length === 0) return;
    const g = groupOf(currentHash);
    const anchor = g ? g.latest.hashId : currentHash;
    let i = order.indexOf(anchor);
    if (i < 0) i = 0;
    setCurrentHash(order[(i + delta + order.length) % order.length]);
  }

  const currentGroup = current ? groupOf(current.hashId) : null;
  const showVersionInBar =
    current && currentGroup && currentGroup.versions.length > 1;

  return (
    <div className="wrap music">
      <div className="music-head">
        <h1>Music</h1>
      </div>

      <div className="music-filters">
        <input
          className="music-search"
          placeholder="Search title or singer…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="tracklist">
        {shown.map((g) => {
          const s = g.latest;
          const isCurrent = g.versions.some((v) => v.hashId === currentHash);
          const isOpen = expanded === g.key;
          return (
            <div key={g.key} className="track-group">
              <div
                className={`track${isCurrent ? " current" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => playHash(s.hashId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    playHash(s.hashId);
                  }
                }}
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
                  <span className="track-titlerow">
                    <span className="track-title">{s.title}</span>
                    {g.versions.length > 1 && (
                      <span className="badge ver" title={`${g.versions.length} versions`}>
                        {g.versions.length} versions
                      </span>
                    )}
                    {s.statusTags.map((t) => (
                      <span key={t} className="badge status" title="Status">
                        {t}
                      </span>
                    ))}
                  </span>
                  <span className="track-sub">{s.singers.join(", ")}</span>
                </span>

                <span className="track-genres">{s.genres.join(" · ")}</span>
                <span className="track-dur">
                  {s.durationSec != null ? fmt(s.durationSec) : ""}
                </span>

                <button
                  className={`track-expand${isOpen ? " open" : ""}`}
                  aria-label={isOpen ? "Collapse" : "Details"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(isOpen ? null : g.key);
                  }}
                >
                  <ChevronIcon />
                </button>
              </div>

              {isOpen && (
                <div className="track-detail">
                  {s.description && <p className="desc">{s.description}</p>}
                  {g.versions.length > 1 && (
                    <div className="versions">
                      {g.versions.map((v, i) => (
                        <button
                          key={v.hashId}
                          className={`version-row${v.hashId === currentHash ? " current" : ""}`}
                          onClick={() => playHash(v.hashId)}
                        >
                          <span className="v-play">
                            {v.hashId === currentHash && playing ? (
                              <PauseIcon />
                            ) : (
                              <PlayIcon />
                            )}
                          </span>
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
              )}
            </div>
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
                <div className="np-title">
                  {current.title}
                  {showVersionInBar && (
                    <span className="np-ver">v{current.version}</span>
                  )}
                </div>
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
const ChevronIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
