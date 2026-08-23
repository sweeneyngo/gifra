import type { Metadata } from "next";
import { listProjects, listSnapshots, type WplaceSnapshot } from "@/lib/wplace";
import { ProgressChart } from "./ProgressChart";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "wplace" };

const pct = (n: number) => `${n.toFixed(1)}%`;

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "just now";
  const m = s / 60;
  if (m < 90) return `${Math.round(m)}m ago`;
  const h = m / 60;
  if (h < 36) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default async function Wplace() {
  const projects = await listProjects();
  const withHistory = await Promise.all(
    projects.map(async (p) => ({
      project: p,
      snapshots: await listSnapshots(p.id),
    })),
  );

  return (
    <div className="wrap">
      <div className="hline" />
      <header className="banner-inner" style={{ padding: "1.5rem 0" }}>
        <div className="banner-title">
          <span className="eyebrow">wplace.live</span>
          <h1>Canvas Watch</h1>
        </div>
        <p className="wp-intro">
          Progress of pixel-art drawings pinned to the{" "}
          <a href="https://wplace.live" target="_blank" rel="noreferrer">
            wplace
          </a>{" "}
          world canvas, sampled every 15 minutes.
        </p>
      </header>
      <div className="hline" />

      {withHistory.length === 0 ? (
        <p className="wp-empty">
          No drawings tracked yet. Add one with{" "}
          <code>node --env-file=.env.local scripts/wplace-add.ts …</code>
        </p>
      ) : (
        <div className="wp-list">
          {withHistory.map(({ project, snapshots }) => {
            const latest: WplaceSnapshot | undefined = snapshots[snapshots.length - 1];
            return (
              <section key={project.id} className="wp-project">
                <div className="wp-head">
                  <div>
                    <h2>{project.title ?? project.slug}</h2>
                    <span className="wp-sub">
                      {project.width}×{project.height} · tile {project.tile_x},{project.tile_y}
                      {latest ? ` · updated ${timeAgo(latest.taken_at)}` : ""}
                    </span>
                  </div>
                  <div className="wp-pct">{latest ? pct(latest.percent) : "—"}</div>
                </div>

                <div className="wp-renders">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <figure>
                    <img src={`/api/wplace/${project.slug}/render?view=template`} alt="target" />
                    <figcaption>Target</figcaption>
                  </figure>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <figure>
                    <img src={`/api/wplace/${project.slug}/render?view=diff`} alt="current vs target" />
                    <figcaption>Now (red = wrong, grey = unpainted)</figcaption>
                  </figure>
                </div>

                {latest && (
                  <div className="wp-stats">
                    <span><b>{latest.correct_px}</b> correct</span>
                    <span><b>{latest.wrong_px}</b> wrong</span>
                    <span><b>{latest.missing_px}</b> unpainted</span>
                    <span><b>{latest.total_px}</b> total</span>
                  </div>
                )}

                <ProgressChart snapshots={snapshots} />
              </section>
            );
          })}
        </div>
      )}

      <div className="hline" />
    </div>
  );
}
