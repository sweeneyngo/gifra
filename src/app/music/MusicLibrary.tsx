"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Song } from "@/lib/music";
import { usePlayer } from "@/app/player/PlayerProvider";
import { CoverArt } from "@/app/CoverArt";
import { groupSongs, fmt, fmtDate, songSlug } from "./lib";

export function MusicLibrary({ songs }: { songs: Song[] }) {
  const player = usePlayer();
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Feed the library into the global player once.
  useEffect(() => {
    player.hydrate(songs);
  }, [songs, player]);

  const groups = useMemo(() => groupSongs(songs), [songs]);

  const lastUpdated = useMemo(() => {
    const max = songs.reduce<string | null>(
      (m, s) => (s.releasedAt && (!m || s.releasedAt > m) ? s.releasedAt : m),
      null,
    );
    return max ? fmtDate(max) : null;
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
      <div className="hline" />
      <div className="music-head">
        <h1>Music Library</h1>
        <p className="music-desc">
          A collection of all my music &amp; covers over the years.
        </p>
        <div className="music-meta">
          {lastUpdated && (
            <span className="music-updated">Last updated {lastUpdated}</span>
          )}
          <span className="music-socials">
            <a
              href="https://www.youtube.com/@86misu"
              target="_blank"
              rel="noreferrer"
              aria-label="YouTube"
              title="YouTube"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d={YT_PATH} />
              </svg>
            </a>
            <a
              href="https://soundcloud.com/rootmisu"
              target="_blank"
              rel="noreferrer"
              aria-label="SoundCloud"
              title="SoundCloud"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d={SC_PATH} />
              </svg>
            </a>
          </span>
        </div>
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
                  <CoverArt src={s.artUrl} alt="" />
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
                  <Link href={`/music/${songSlug(g)}`} className="song-permalink">
                    Open song page ↗
                  </Link>
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

// Official brand marks (simple-icons, CC0), inlined to keep them out of the bundle.
const YT_PATH =
  "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z";
const SC_PATH =
  "M23.999 14.165c-.052 1.796-1.612 3.169-3.4 3.169h-8.18a.68.68 0 0 1-.675-.683V7.862a.747.747 0 0 1 .452-.724s.75-.513 2.333-.513a5.364 5.364 0 0 1 2.763.755 5.433 5.433 0 0 1 2.57 3.54c.282-.08.574-.121.868-.12.884 0 1.73.358 2.347.992s.948 1.49.922 2.373ZM10.721 8.421c.247 2.98.427 5.697 0 8.672a.264.264 0 0 1-.53 0c-.395-2.946-.22-5.718 0-8.672a.264.264 0 0 1 .53 0ZM9.072 9.448c.285 2.659.37 4.986-.006 7.655a.277.277 0 0 1-.55 0c-.331-2.63-.256-5.02 0-7.655a.277.277 0 0 1 .556 0Zm-1.663-.257c.27 2.726.39 5.171 0 7.904a.266.266 0 0 1-.532 0c-.38-2.69-.257-5.21 0-7.904a.266.266 0 0 1 .532 0Zm-1.647.77a26.108 26.108 0 0 1-.008 7.147.272.272 0 0 1-.542 0 27.955 27.955 0 0 1 0-7.147.275.275 0 0 1 .55 0Zm-1.67 1.769c.421 1.865.228 3.5-.029 5.388a.257.257 0 0 1-.514 0c-.21-1.858-.398-3.549 0-5.389a.272.272 0 0 1 .543 0Zm-1.655-.273c.388 1.897.26 3.508-.01 5.412-.026.28-.514.283-.54 0-.244-1.878-.347-3.54-.01-5.412a.283.283 0 0 1 .56 0Zm-1.668.911c.4 1.268.257 2.292-.026 3.572a.257.257 0 0 1-.514 0c-.241-1.262-.354-2.312-.023-3.572a.283.283 0 0 1 .563 0Z";

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
