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
} from "react";
import type { Song } from "@/lib/music";
import { groupSongs, fmt } from "@/app/music/lib";

type Repeat = "off" | "all" | "one";

interface PlayerCtx {
  currentHash: string | null;
  playing: boolean;
  hydrate: (songs: Song[]) => void;
  playHash: (hash: string) => void;
}

const Ctx = createContext<PlayerCtx | null>(null);
export const usePlayer = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePlayer must be used within PlayerProvider");
  return c;
};

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [normalize, setNormalize] = useState(false);
  const [currentHash, setCurrentHash] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>("off");
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

  const hydrate = useCallback((s: Song[]) => {
    setSongs((prev) => (prev.length === 0 && s.length ? s : prev));
  }, []);
  // Lazily build the Web Audio graph on first play (needs a user gesture):
  //   <audio> → gain (normalize) → analyser (meter) → speakers.
  // If it fails (e.g. CORS), the element keeps playing directly.
  const ensureGraph = useCallback(() => {
    if (audioCtxRef.current || !audioRef.current) return;
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AC();
      const src = ctx.createMediaElementSource(audioRef.current);
      const gain = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(gain);
      gain.connect(analyser);
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      gainRef.current = gain;
      analyserRef.current = analyser;
    } catch {
      /* graph unavailable — direct playback still works */
    }
  }, []);
  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    ensureGraph();
    audioCtxRef.current?.resume();
    if (a.paused) a.play();
    else a.pause();
  }, [ensureGraph]);
  const playHash = useCallback(
    (h: string) => {
      ensureGraph();
      audioCtxRef.current?.resume();
      if (h === currentHash) togglePlay();
      else setCurrentHash(h);
    },
    [currentHash, togglePlay, ensureGraph],
  );

  // Stable context value: only changes when currentHash/playing change, NOT on
  // every timeupdate — so the library doesn't re-render during playback.
  const ctxValue = useMemo<PlayerCtx>(
    () => ({ currentHash, playing, hydrate, playHash }),
    [currentHash, playing, hydrate, playHash],
  );
  function stop() {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    setTime(0);
    setPlaying(false);
  }
  function next() {
    if (order.length === 0) return;
    const i = anchorIndex();
    setCurrentHash(shuffle ? randomHash(i) : order[(i + 1) % order.length]);
  }
  function prev() {
    if (order.length === 0) return;
    const a = audioRef.current;
    if (a && a.currentTime > 3) {
      a.currentTime = 0; // restart current, Spotify-style
      return;
    }
    const i = anchorIndex();
    setCurrentHash(
      shuffle ? randomHash(i) : order[(i - 1 + order.length) % order.length],
    );
  }
  function onEnded() {
    // repeat "one" is handled by the audio element's loop flag.
    const i = anchorIndex();
    if (shuffle) {
      setCurrentHash(randomHash(i));
      return;
    }
    if (i + 1 < order.length) setCurrentHash(order[i + 1]);
    else if (repeat === "all") setCurrentHash(order[0]);
    else stop();
  }
  function cycleRepeat() {
    setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off"));
  }

  // Load + play whenever the track changes.
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !currentHash) return;
    ensureGraph();
    audioCtxRef.current?.resume();
    a.src = `/api/music/songs/${currentHash}/stream`;
    a.play().catch(() => setPlaying(false));
  }, [currentHash, ensureGraph]);
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = vol;
  }, [vol]);
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, currentHash]);
  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = repeat === "one";
  }, [repeat, currentHash]);

  // Loudness normalization: gain = 10^((target − trackLUFS)/20), target −14 LUFS.
  useEffect(() => {
    const g = gainRef.current;
    const ctx = audioCtxRef.current;
    if (!g || !ctx) return;
    const lufs = current?.lufs ?? null;
    const val =
      normalize && lufs != null ? Math.pow(10, (-14 - lufs) / 20) : 1;
    g.gain.setTargetAtTime(val, ctx.currentTime, 0.08);
  }, [normalize, current]);

  const currentGroup = current ? groupOf(current.hashId) : null;
  const showVer = current && currentGroup && currentGroup.versions.length > 1;

  return (
    <Ctx.Provider value={ctxValue}>
      <div className={current ? "app-shell playing" : "app-shell"}>
        {children}
      </div>

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
                  {showVer && <span className="np-ver">v{current.version}</span>}
                </div>
                <div className="np-sub">{current.singers.join(", ")}</div>
              </div>
            </div>

            <div className="np-center">
              <div className="np-controls">
                <button onClick={stop} aria-label="Stop" title="Stop">
                  <StopIcon />
                </button>
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

      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onEnded={onEnded}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
    </Ctx.Provider>
  );
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

/** Live RMS level (dBFS) read from the analyser while playing. */
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
    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      setDb(rms > 1e-7 ? 20 * Math.log10(rms) : -Infinity);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [analyser, playing]);

  if (!analyser) return <span>—</span>;
  if (db == null || !isFinite(db)) return <span>−∞ dB</span>;
  return <span>{db.toFixed(1)} dB</span>;
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
const StopIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
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
