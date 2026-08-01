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
  publishedAt: string | null; // most recent release date across versions
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
  const [showDesc, setShowDesc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [loop, setLoop] = useState(false);

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
        const publishedAt = vs.reduce<string | null>(
          (max, v) =>
            v.releasedAt && (!max || v.releasedAt > max) ? v.releasedAt : max,
          null,
        );
        return {
          key: sorted[0].songGroupHashId || sorted[0].hashId,
          latest: sorted[0],
          versions: sorted,
          publishedAt,
        };
      })
      // Default sort: most recently *published* first (nulls last).
      .sort((a, b) => {
        if (a.publishedAt && b.publishedAt)
          return b.publishedAt.localeCompare(a.publishedAt);
        if (a.publishedAt) return -1;
        if (b.publishedAt) return 1;
        return a.latest.title.localeCompare(b.latest.title);
      });
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
    // Auto-expand the playing song's detail.
    const g = groups.find((gr) =>
      gr.versions.some((v) => v.hashId === currentHash),
    );
    setExpanded(g?.key ?? null);
  }, [currentHash, groups]);

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = vol;
  }, [vol]);

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.loop = loop;
  }, [loop]);

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

            <div className="np-right">
              <button
                className={`np-icon${showDesc ? " on" : ""}`}
                aria-label="Description"
                onClick={() => {
                  setShowDesc((v) => !v);
                  setShowSettings(false);
                }}
              >
                <DescIcon />
              </button>
              <a
                className="np-icon"
                href={`/api/music/songs/${current.hashId}/stream?dl=1`}
                download
                aria-label="Download"
              >
                <DownloadIcon />
              </a>
              <button
                className={`np-icon${showSettings ? " on" : ""}`}
                aria-label="Settings"
                onClick={() => {
                  setShowSettings((v) => !v);
                  setShowDesc(false);
                }}
              >
                <GearIcon />
              </button>
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
            </div>

            {showDesc && (
              <div className="np-popover np-desc-card">
                <div className="pop-title">{current.title}</div>
                <p className="desc">
                  {current.description || "No description."}
                </p>
              </div>
            )}
            {showSettings && (
              <div className="np-popover np-settings-menu">
                <label className="setting">
                  <span>Autoplay next</span>
                  <input
                    type="checkbox"
                    checked={autoplay}
                    onChange={(e) => setAutoplay(e.target.checked)}
                  />
                </label>
                <label className="setting">
                  <span>Loop track</span>
                  <input
                    type="checkbox"
                    checked={loop}
                    onChange={(e) => setLoop(e.target.checked)}
                  />
                </label>
              </div>
            )}
          </>
        )}
      </div>

      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onEnded={() => {
          if (autoplay) step(1);
        }}
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
const DescIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
);
const DownloadIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" />
  </svg>
);
const GearIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
