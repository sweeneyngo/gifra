"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
} from "react";
import type { Song } from "@/lib/music";
import { groupSongs, fmt } from "@/app/music/lib";
import { CoverArt } from "@/app/CoverArt";

type Repeat = "off" | "all" | "one";

interface PlayerCtx {
  currentHash: string | null;
  playing: boolean;
  hydrate: (songs: Song[]) => void;
  playHash: (hash: string) => void;
  seek: (t: number) => void;
  getProgress: () => { time: number; dur: number };
}

const Ctx = createContext<PlayerCtx | null>(null);
export const usePlayer = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePlayer must be used within PlayerProvider");
  return c;
};

const streamUrl = (hash: string) => `/api/music/songs/${hash}/stream`;

export function PlayerProvider({ children }: { children: ReactNode }) {
  // Two audio elements (A/B) so tracks can overlap for crossfade.
  const elA = useRef<HTMLAudioElement>(null);
  const elB = useRef<HTMLAudioElement>(null);
  const active = useRef(0); // index of the element that "is" currentHash
  const crossfading = useRef(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainA = useRef<GainNode | null>(null);
  const gainB = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const [songs, setSongs] = useState<Song[]>([]);
  const [currentHash, setCurrentHash] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>("off");
  const [normalize, setNormalize] = useState(false);
  const [crossfade, setCrossfade] = useState(false);
  const [crossfadeSec, setCrossfadeSec] = useState(6);
  const [showDesc, setShowDesc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const closePops = () => {
    setShowDesc(false);
    setShowSettings(false);
    setShowInfo(false);
  };

  const byHash = useMemo(
    () => new Map(songs.map((s) => [s.hashId, s])),
    [songs],
  );
  const current = currentHash ? (byHash.get(currentHash) ?? null) : null;
  const groups = useMemo(() => groupSongs(songs), [songs]);
  const order = useMemo(() => groups.map((g) => g.latest.hashId), [groups]);

  const el = (i: number) => (i === 0 ? elA.current : elB.current);
  const gain = (i: number) => (i === 0 ? gainA.current : gainB.current);
  const activeEl = () => el(active.current);

  const groupOf = (hash: string) =>
    groups.find((g) => g.versions.some((v) => v.hashId === hash));
  const anchorIndex = () => {
    if (!currentHash) return -1;
    const g = groupOf(currentHash);
    return order.indexOf(g ? g.latest.hashId : currentHash);
  };
  const randomHash = (exclude: number) => {
    if (order.length <= 1) return order[0];
    let j = exclude;
    while (j === exclude) j = Math.floor(Math.random() * order.length);
    return order[j];
  };
  const normFactor = (hash: string | null) => {
    const lufs = hash ? (byHash.get(hash)?.lufs ?? null) : null;
    return normalize && lufs != null ? Math.pow(10, (-14 - lufs) / 20) : 1;
  };

  // Build the graph on first play: each element → gain → analyser → speakers.
  const ensureGraph = useCallback(() => {
    if (audioCtxRef.current || !elA.current || !elB.current) return;
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AC();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.connect(ctx.destination);
      const mk = (media: HTMLAudioElement) => {
        const src = ctx.createMediaElementSource(media);
        const g = ctx.createGain();
        g.gain.value = 0;
        src.connect(g);
        g.connect(analyser);
        return g;
      };
      gainA.current = mk(elA.current);
      gainB.current = mk(elB.current);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
    } catch {
      /* graph unavailable — fall back to direct element playback */
    }
  }, []);

  // Core transition. cross=true fades from the active element to the other.
  const startTrack = useCallback(
    (hash: string, cross: boolean) => {
      ensureGraph();
      const ctx = audioCtxRef.current;
      ctx?.resume();
      const norm = normFactor(hash);

      if (!cross || !currentHash || !ctx) {
        // Hard switch on the active element; silence/stop the other.
        const i = active.current;
        const e = el(i);
        const other = el(1 - i);
        const og = gain(1 - i);
        if (other) other.pause();
        if (og && ctx) og.gain.setValueAtTime(0, ctx.currentTime);
        if (e) {
          e.loop = repeat === "one";
          e.src = streamUrl(hash);
          e.currentTime = 0;
          e.play().catch(() => setPlaying(false));
        }
        const g = gain(i);
        if (g && ctx) g.gain.setValueAtTime(norm, ctx.currentTime);
        setCurrentHash(hash);
        return;
      }

      // Crossfade: play the incoming track on the inactive element, ramp gains.
      const outIdx = active.current;
      const inIdx = 1 - outIdx;
      const oe = el(outIdx);
      const ie = el(inIdx);
      const og = gain(outIdx);
      const ig = gain(inIdx);
      if (!ie || !ig || !og) return;
      crossfading.current = true;
      const t = ctx.currentTime;
      const cf = Math.max(0.1, crossfadeSec);

      ie.loop = false;
      ie.src = streamUrl(hash);
      ie.currentTime = 0;
      ie.play().catch(() => {});
      og.gain.cancelScheduledValues(t);
      og.gain.setValueAtTime(og.gain.value, t);
      og.gain.linearRampToValueAtTime(0, t + cf);
      ig.gain.cancelScheduledValues(t);
      ig.gain.setValueAtTime(0, t);
      ig.gain.linearRampToValueAtTime(norm, t + cf);

      active.current = inIdx;
      setCurrentHash(hash);
      window.setTimeout(() => {
        if (oe) oe.pause();
        crossfading.current = false;
      }, cf * 1000);
    },
    [ensureGraph, currentHash, crossfadeSec, repeat, normalize, byHash],
  );

  const hydrate = useCallback((s: Song[]) => {
    setSongs((prev) => (prev.length === 0 && s.length ? s : prev));
  }, []);
  const togglePlay = useCallback(() => {
    const a = activeEl();
    if (!a) return;
    ensureGraph();
    audioCtxRef.current?.resume();
    if (a.paused) a.play();
    else a.pause();
  }, [ensureGraph]);
  const playHash = useCallback(
    (h: string) => {
      if (h === currentHash) {
        togglePlay();
        return;
      }
      startTrack(h, crossfade && playing);
    },
    [currentHash, crossfade, playing, startTrack, togglePlay],
  );
  // Stable (read refs) — safe to expose without churning the context value.
  const seek = useCallback((t: number) => {
    const a = activeEl();
    if (a) {
      a.currentTime = t;
      setTime(t);
    }
  }, []);
  const getProgress = useCallback(
    () => ({
      time: activeEl()?.currentTime ?? 0,
      dur: activeEl()?.duration || 0,
    }),
    [],
  );

  function stop() {
    if (elA.current) elA.current.pause();
    if (elB.current) elB.current.pause();
    const a = activeEl();
    if (a) a.currentTime = 0;
    setTime(0);
    setPlaying(false);
  }
  // The next/prev/end target respecting shuffle + repeat.
  function nextHash(auto: boolean): string | null {
    const i = anchorIndex();
    if (shuffle) return randomHash(i);
    if (i + 1 < order.length) return order[i + 1];
    if (repeat === "all") return order[0];
    return auto ? null : order[0];
  }
  function next() {
    const h = nextHash(false);
    if (h) startTrack(h, crossfade && playing);
  }
  function prev() {
    const a = activeEl();
    if (a && a.currentTime > 3) {
      a.currentTime = 0;
      return;
    }
    const i = anchorIndex();
    const h = shuffle
      ? randomHash(i)
      : order[(i - 1 + order.length) % order.length];
    if (h) startTrack(h, crossfade && playing);
  }
  function onEnded() {
    // If crossfade preempted, this won't fire. Otherwise hard-advance.
    const h = nextHash(true);
    if (h) startTrack(h, false);
    else stop();
  }
  function cycleRepeat() {
    setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off"));
  }

  // Auto-crossfade when the active track nears its end.
  function onProgress(e: HTMLAudioElement) {
    if (
      !crossfade ||
      crossfading.current ||
      repeat === "one" ||
      !isFinite(e.duration)
    )
      return;
    if (e.currentTime >= e.duration - crossfadeSec) {
      const h = nextHash(true);
      if (h) startTrack(h, true);
    }
  }

  // Volume + speed apply to both elements; loop only to the active one.
  useEffect(() => {
    if (elA.current) elA.current.volume = vol;
    if (elB.current) elB.current.volume = vol;
  }, [vol]);
  useEffect(() => {
    if (elA.current) elA.current.playbackRate = speed;
    if (elB.current) elB.current.playbackRate = speed;
  }, [speed, currentHash]);
  useEffect(() => {
    const a = activeEl();
    if (a) a.loop = repeat === "one";
  }, [repeat, currentHash]);

  // Loudness normalization on the active gain (when not mid-crossfade).
  useEffect(() => {
    const g = gain(active.current);
    const ctx = audioCtxRef.current;
    if (!g || !ctx || crossfading.current) return;
    g.gain.setTargetAtTime(normFactor(currentHash), ctx.currentTime, 0.08);
  }, [normalize, currentHash]);

  // --- Media Session (OS / lock-screen / headphone controls) ---
  const transportRef = useRef({
    togglePlay,
    prev,
    next,
    seekTo: (_t: number) => {},
  });
  transportRef.current = {
    togglePlay,
    prev,
    next,
    seekTo: (t: number) => {
      const a = activeEl();
      if (a) {
        a.currentTime = t;
        setTime(t);
      }
    },
  };
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator))
      return;
    const ms = navigator.mediaSession;
    ms.setActionHandler("play", () => transportRef.current.togglePlay());
    ms.setActionHandler("pause", () => transportRef.current.togglePlay());
    ms.setActionHandler("previoustrack", () => transportRef.current.prev());
    ms.setActionHandler("nexttrack", () => transportRef.current.next());
    try {
      ms.setActionHandler("seekto", (d) => {
        if (d.seekTime != null) transportRef.current.seekTo(d.seekTime);
      });
    } catch {
      /* seekto unsupported */
    }
    return () => {
      for (const a of [
        "play",
        "pause",
        "previoustrack",
        "nexttrack",
        "seekto",
      ] as const) {
        try {
          ms.setActionHandler(a, null);
        } catch {
          /* ignore */
        }
      }
    };
  }, []);
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator))
      return;
    if (!current) {
      navigator.mediaSession.metadata = null;
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.singers.join(", "),
      album: "gifra",
      artwork: current.artUrl
        ? [{ src: current.artUrl, sizes: "512x512", type: "image/png" }]
        : [],
    });
  }, [current]);
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator))
      return;
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }, [playing]);

  const ctxValue = useMemo<PlayerCtx>(
    () => ({ currentHash, playing, hydrate, playHash, seek, getProgress }),
    [currentHash, playing, hydrate, playHash, seek, getProgress],
  );

  const currentGroup = current ? groupOf(current.hashId) : null;
  const showVer = current && currentGroup && currentGroup.versions.length > 1;

  // Shared handlers, gated to the active element.
  const isActive = (e: HTMLAudioElement) => e === activeEl();
  const audioProps = (self: RefObject<HTMLAudioElement | null>) => ({
    ref: self,
    crossOrigin: "anonymous" as const,
    onTimeUpdate: (e: SyntheticEvent<HTMLAudioElement>) => {
      const a = e.currentTarget;
      if (isActive(a)) setTime(a.currentTime);
      onProgress(a);
    },
    onLoadedMetadata: (e: SyntheticEvent<HTMLAudioElement>) => {
      if (isActive(e.currentTarget)) setDur(e.currentTarget.duration);
    },
    onEnded: (e: SyntheticEvent<HTMLAudioElement>) => {
      if (isActive(e.currentTarget)) onEnded();
    },
    onPlay: (e: SyntheticEvent<HTMLAudioElement>) => {
      if (isActive(e.currentTarget)) setPlaying(true);
    },
    onPause: (e: SyntheticEvent<HTMLAudioElement>) => {
      if (isActive(e.currentTarget)) setPlaying(false);
    },
  });

  return (
    <Ctx.Provider value={ctxValue}>
      <div className={current ? "app-shell playing" : "app-shell"}>
        {children}
      </div>

      <div className={`nowplaying${current ? " show" : ""}`}>
        {current && (
          <>
            <div className="np-track">
              <span className="np-art">
                <CoverArt src={current.artUrl} alt="" />
              </span>
              <div className="np-meta">
                <div className="np-title">
                  {current.title}
                  {showVer && <span className="np-ver">v{current.version}</span>}
                </div>
                <div className="np-sub">{current.singers.join(", ")}</div>
              </div>
            </div>

            <div className="np-center">
              <div className="np-controls">
                <button
                  className={shuffle ? "on" : ""}
                  onClick={() => setShuffle((s) => !s)}
                  aria-label="Shuffle"
                  title="Shuffle"
                >
                  <ShuffleIcon />
                </button>
                <button onClick={prev} aria-label="Previous">
                  <PrevIcon />
                </button>
                <button
                  className="np-play"
                  onClick={togglePlay}
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing ? <PauseIcon /> : <PlayIcon />}
                </button>
                <button onClick={next} aria-label="Next">
                  <NextIcon />
                </button>
                <button
                  className={repeat !== "off" ? "on" : ""}
                  onClick={cycleRepeat}
                  aria-label={`Repeat: ${repeat}`}
                  title={`Repeat: ${repeat}`}
                >
                  {repeat === "one" ? <RepeatOneIcon /> : <RepeatIcon />}
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
                    const a = activeEl();
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
                className={`np-icon${showInfo ? " on" : ""}`}
                aria-label="Audio info"
                onClick={() => {
                  const v = !showInfo;
                  closePops();
                  setShowInfo(v);
                }}
              >
                <InfoIcon />
              </button>
              <button
                className={`np-icon${showDesc ? " on" : ""}`}
                aria-label="Description"
                onClick={() => {
                  const v = !showDesc;
                  closePops();
                  setShowDesc(v);
                }}
              >
                <DescIcon />
              </button>
              <a
                className="np-icon"
                href={`${streamUrl(current.hashId)}?dl=1`}
                download
                aria-label="Download"
              >
                <DownloadIcon />
              </a>
              <button
                className={`np-icon${showSettings ? " on" : ""}`}
                aria-label="Settings"
                onClick={() => {
                  const v = !showSettings;
                  closePops();
                  setShowSettings(v);
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

            {showInfo && (
              <div className="np-popover np-info-card">
                <div className="pop-title">Audio</div>
                <dl className="info-grid">
                  {specRows(current).map(([k, v]) => (
                    <div className="info-row" key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                  <div className="info-row">
                    <dt>Level (RMS)</dt>
                    <dd>
                      <LiveLevel analyser={analyserRef.current} playing={playing} />
                    </dd>
                  </div>
                </dl>
              </div>
            )}
            {showDesc && (
              <div className="np-popover np-desc-card">
                <div className="pop-title">{current.title}</div>
                <p className="desc">{current.description || "No description."}</p>
              </div>
            )}
            {showSettings && (
              <div className="np-popover np-settings-menu">
                <div className="setting-label">Audio Options</div>
                <label className="setting-toggle">
                  <span>
                    Normalize volume<small>−14 LUFS</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={normalize}
                    onChange={(e) => setNormalize(e.target.checked)}
                  />
                </label>
                <label className="setting-toggle">
                  <span>
                    Crossfade
                    <small>
                      {crossfade ? `${crossfadeSec}s overlap` : "off"}
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    checked={crossfade}
                    onChange={(e) => setCrossfade(e.target.checked)}
                  />
                </label>
                {crossfade && (
                  <input
                    className="cf-slider"
                    type="range"
                    min={1}
                    max={12}
                    step={1}
                    value={crossfadeSec}
                    onChange={(e) => setCrossfadeSec(Number(e.target.value))}
                  />
                )}
                <div className="setting-label">Playback speed</div>
                <div className="speed-row">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((sp) => (
                    <button
                      key={sp}
                      className={`speed-btn${speed === sp ? " on" : ""}`}
                      onClick={() => setSpeed(sp)}
                    >
                      {sp}×
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <audio {...audioProps(elA)} />
      <audio {...audioProps(elB)} />
    </Ctx.Provider>
  );
}

/** Live RMS level (dBFS), integrated over 1s to keep the readout calm. */
function LiveLevel({
  analyser,
  playing,
}: {
  analyser: AnalyserNode | null;
  playing: boolean;
}) {
  const [db, setDb] = useState<number | null>(null);
  useEffect(() => {
    if (!analyser || !playing) return;
    const buf = new Float32Array(analyser.fftSize);
    let raf = 0;
    let sumSq = 0;
    let count = 0;
    let last = performance.now();
    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      for (let i = 0; i < buf.length; i++) {
        sumSq += buf[i] * buf[i];
        count++;
      }
      const now = performance.now();
      if (now - last >= 1000) {
        const rms = count ? Math.sqrt(sumSq / count) : 0;
        setDb(rms > 1e-7 ? 20 * Math.log10(rms) : -Infinity);
        sumSq = 0;
        count = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [analyser, playing]);

  if (!analyser) return <span>—</span>;
  if (db == null || !isFinite(db)) return <span>−∞ dB</span>;
  return <span>{db.toFixed(1)} dB</span>;
}

function specRows(s: Song): [string, string][] {
  const rows: [string, string][] = [];
  if (s.audioFormat) rows.push(["Format", s.audioFormat.toUpperCase()]);
  if (s.bitrate) rows.push(["Bitrate", `${s.bitrate} kbps`]);
  if (s.sampleRate)
    rows.push(["Sample rate", `${(s.sampleRate / 1000).toFixed(1)} kHz`]);
  if (s.channels)
    rows.push([
      "Channels",
      s.channels === 2 ? "Stereo" : s.channels === 1 ? "Mono" : `${s.channels}`,
    ]);
  if (s.durationSec != null) rows.push(["Duration", fmt(s.durationSec)]);
  if (s.lufs != null) rows.push(["Loudness", `${s.lufs.toFixed(1)} LUFS`]);
  return rows;
}

/* ---- icons ---- */
const InfoIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);
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
const ShuffleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
  </svg>
);
const RepeatIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m17 2 4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4m14 1v2a4 4 0 0 1-4 4H3" />
  </svg>
);
const RepeatOneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m17 2 4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4m14 1v2a4 4 0 0 1-4 4H3" />
    <text x="12" y="15" fontSize="8" fontWeight="700" fill="currentColor" stroke="none" textAnchor="middle">1</text>
  </svg>
);
const VolIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M4 9v6h3l4 4V5L7 9zm11 3a3 3 0 0 0-2-2.8v5.6A3 3 0 0 0 15 12z" />
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
