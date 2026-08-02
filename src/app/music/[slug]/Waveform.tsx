"use client";

import { useEffect, useRef } from "react";
import { usePlayer } from "@/app/player/PlayerProvider";
import { fmt } from "../lib";

/**
 * SoundCloud-style waveform scrubber. Renders two bar layers (base + played);
 * the played layer is clip-revealed to the current progress each frame via a
 * ref (no per-bar re-render). Click to seek / play.
 */
export function Waveform({
  peaks,
  hash,
  duration,
}: {
  peaks: number[];
  hash: string;
  duration: number | null;
}) {
  const player = usePlayer();
  const rootRef = useRef<HTMLDivElement>(null);
  const playedRef = useRef<HTMLDivElement>(null);
  const curRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      let frac = 0;
      let time = 0;
      if (player.currentHash === hash) {
        const p = player.getProgress();
        time = p.time;
        frac = p.dur ? p.time / p.dur : 0;
      }
      if (playedRef.current)
        playedRef.current.style.clipPath = `inset(0 ${(1 - frac) * 100}% 0 0)`;
      if (curRef.current) curRef.current.textContent = fmt(time);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [player, hash]);

  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (player.currentHash !== hash) {
      player.playHash(hash);
      return;
    }
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const { dur } = player.getProgress();
    if (dur) player.seek(frac * dur);
  };

  const bars = peaks.map((p, i) => (
    <span key={i} style={{ height: `${Math.max(7, p * 100)}%` }} />
  ));

  return (
    <div className="wave-wrap">
      <div className="wave" ref={rootRef} onClick={onSeek}>
        <div className="wave-base">{bars}</div>
        <div className="wave-played" ref={playedRef}>
          {bars}
        </div>
      </div>
      <div className="wave-times">
        <span className="cur" ref={curRef}>
          0:00
        </span>
        <span>{duration != null ? fmt(duration) : ""}</span>
      </div>
    </div>
  );
}
