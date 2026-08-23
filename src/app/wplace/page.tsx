import type { Metadata } from "next";
import {
  listProjects,
  listSnapshots,
  templateColors,
  deriveAlerts,
  idleSince,
  wplaceLink,
  type ColorCount,
  type WplaceSnapshot,
} from "@/lib/wplace";
import { ProgressChart } from "./ProgressChart";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "wplace" };

const pct = (n: number) => `${n.toFixed(1)}%`;
const num = (n: number) => n.toLocaleString();

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "just now";
  const m = s / 60;
  if (m < 90) return `${Math.round(m)}m ago`;
  const h = m / 60;
  if (h < 36) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function ColorBreakdown({ colors, total }: { colors: ColorCount[]; total: number }) {
  if (colors.length === 0) return null;
  return (
    <div className="wp-colors">
      <span className="wp-section-label">
        Colours · {colors.length} in template
      </span>
      <ul className="wp-swatches">
        {colors.map((c) => {
          const share = total ? (c.count / total) * 100 : 0;
          return (
            <li key={c.hex} className="wp-swatch" title={`${c.hex} — ${num(c.count)} px (${share.toFixed(1)}%)`}>
              <span className="wp-swatch-chip" style={{ background: c.hex }} />
              <span className="wp-swatch-hex">{c.hex}</span>
              <span className="wp-swatch-count">{num(c.count)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default async function Wplace() {
  const projects = await listProjects();
  const withHistory = await Promise.all(
    projects.map(async (p) => ({
      project: p,
      snapshots: await listSnapshots(p.id),
      colors: await templateColors(p),
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
            wplace world canvas
          </a>
          , sampled every 15 minutes.
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
          {withHistory.map(({ project, snapshots, colors }) => {
            const latest: WplaceSnapshot | undefined = snapshots[snapshots.length - 1];
            const alerts = deriveAlerts(snapshots);
            const idle = idleSince(snapshots);
            const link = wplaceLink(project);
            const download = `/api/wplace/${project.slug}/render?download=1`;
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

                {alerts.length > 0 && (
                  <div className="wp-banners">
                    {alerts.map((a, i) => (
                      <div key={i} className={`wp-banner wp-banner-${a.level}`} role={a.level === "danger" ? "alert" : "status"}>
                        {a.message}
                      </div>
                    ))}
                  </div>
                )}

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
                  <>
                    <div className="wp-stats">
                      <span><b>{num(latest.correct_px)}</b> correct</span>
                      <span><b>{num(latest.wrong_px)}</b> wrong</span>
                      <span><b>{num(latest.missing_px)}</b> remaining</span>
                      <span><b>{num(latest.total_px)}</b> total</span>
                    </div>
                    <div className="wp-activity">
                      {latest.missing_px > 0
                        ? `${num(latest.missing_px)} pixel${latest.missing_px === 1 ? "" : "s"} left to paint`
                        : "All tracked pixels painted"}
                      {idle
                        ? idle.steps <= 1
                          ? " · active this check"
                          : ` · no change for ${timeAgo(idle.since)}`
                        : ""}
                    </div>
                  </>
                )}

                <div className="wp-meta">
                  <a className="wp-meta-item" href={link} target="_blank" rel="noreferrer">
                    ↗ Open on wplace <span className="wp-meta-sub">tile {project.tile_x},{project.tile_y} · px {project.offset_x},{project.offset_y}</span>
                  </a>
                  <a className="wp-meta-item" href={download}>
                    ↓ Download template <span className="wp-meta-sub">{project.width}×{project.height} PNG</span>
                  </a>
                  {project.author && (
                    <span className="wp-meta-item">
                      {project.source_url ? (
                        <a href={project.source_url} target="_blank" rel="noreferrer">by {project.author}</a>
                      ) : (
                        <>by {project.author}</>
                      )}
                    </span>
                  )}
                  {!project.author && project.source_url && (
                    <a className="wp-meta-item" href={project.source_url} target="_blank" rel="noreferrer">↗ Source</a>
                  )}
                  <span className="wp-meta-item wp-meta-muted">added {new Date(project.created_at).toLocaleDateString()}</span>
                </div>

                <ColorBreakdown colors={colors} total={latest?.total_px ?? 0} />

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
