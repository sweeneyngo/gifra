"use client";

import { useEffect, useMemo, useState } from "react";
import type { Song } from "@/lib/music";
import { usePlayer } from "@/app/player/PlayerProvider";
import { groupSongs, fmt, fmtDate } from "./lib";

export function MusicLibrary({ songs }: { songs: Song[] }) {
  const player = usePlayer();
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Feed the library into the global player once.
  useEffect(() => {
    player.hydrate(songs);
  }, [songs, player]);

  const groups = useMemo(() => groupSongs(songs), [songs]);

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return groups;
    return groups.filter(
      (g) =>
        g.latest.title.toLowerCase().includes(n) ||
        g.latest.singers.join(" ").toLowerCase().includes(n),
    );
  }, [groups, q]);

  // Auto-expand the playing song's detail (works even when playback started elsewhere).
  useEffect(() => {
    if (!player.currentHash) return;
    const g = groups.find((gr) =>
      gr.versions.some((v) => v.hashId === player.currentHash),
    );
    if (g) setExpanded(g.key);
  }, [player.currentHash, groups]);

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
          const isCurrent = g.versions.some(
            (v) => v.hashId === player.currentHash,
          );
          const isOpen = expanded === g.key;
          return (
            <div key={g.key} className="track-group">
              <div
                className={`track${isCurrent ? " current" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => player.playHash(s.hashId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    player.playHash(s.hashId);
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
                    {isCurrent && player.playing ? <PauseIcon /> : <PlayIcon />}
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
                          className={`version-row${v.hashId === player.currentHash ? " current" : ""}`}
                          onClick={() => player.playHash(v.hashId)}
                        >
                          <span className="v-play">
                            {v.hashId === player.currentHash && player.playing ? (
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
    </div>
  );
}

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
const ChevronIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
