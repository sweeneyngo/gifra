import { sql } from "@/lib/db";

// wplace serves the world canvas as a fixed grid of PNG tiles. The base zoom is
// a 2048×2048 grid and every tile is 1000×1000 painted pixels, so a pixel's
// global position is `tile * TILE + offset`. There is no official API; this is
// the stable static-tile endpoint the community relies on.
export const TILE = 1000;
export const GRID = 2048;
const TILE_URL = (tx: number, ty: number) =>
  `https://backend.wplace.live/files/s0/tiles/${tx}/${ty}.png`;

// Browser-like UA — the backend sits behind Cloudflare and rejects some bots.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/125.0 Safari/537.36";

// Blue Marble's convention: a #deface pixel in a template means "leave this
// transparent / don't track it", distinct from a genuinely painted colour.
const IGNORE = { r: 0xde, g: 0xfa, b: 0xce };

export interface WplaceProject {
  id: string;
  slug: string;
  title: string | null;
  tile_x: number;
  tile_y: number;
  offset_x: number;
  offset_y: number;
  width: number;
  height: number;
  author: string | null;
  source_url: string | null;
  created_at: string;
}

export interface WplaceSnapshot {
  id: string;
  project_id: string;
  taken_at: string;
  total_px: number;
  correct_px: number;
  wrong_px: number;
  missing_px: number;
  percent: number;
}

export interface DiffResult {
  total: number; // tracked (non-ignored) template pixels
  correct: number; // painted with the target colour
  wrong: number; // painted a different colour (griefed / mismatched)
  missing: number; // not yet painted on the canvas
  percent: number; // correct / total * 100
}

/**
 * Compare a template against the live canvas, pixel for pixel. Both buffers are
 * raw RGBA of the same `width × height`. Template pixels that are transparent or
 * the #deface sentinel are not counted. A live pixel with low alpha is treated
 * as untouched (missing) rather than wrong.
 *
 * Pure and network-free so the accounting can be unit-tested against fixtures.
 */
export function diffPixels(
  template: Uint8Array,
  live: Uint8Array,
  width: number,
  height: number,
): DiffResult {
  let total = 0;
  let correct = 0;
  let wrong = 0;
  let missing = 0;

  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const tr = template[o];
    const tg = template[o + 1];
    const tb = template[o + 2];
    const ta = template[o + 3];

    if (ta < 128) continue; // transparent template pixel → untracked
    if (tr === IGNORE.r && tg === IGNORE.g && tb === IGNORE.b) continue;

    total++;
    if (live[o + 3] < 128) {
      missing++; // canvas pixel is blank → not painted yet
    } else if (live[o] === tr && live[o + 1] === tg && live[o + 2] === tb) {
      correct++;
    } else {
      wrong++;
    }
  }

  return {
    total,
    correct,
    wrong,
    missing,
    percent: total ? (correct / total) * 100 : 0,
  };
}

/** Fetch one canvas tile as a PNG buffer. Never-painted tiles 404 → null. */
async function fetchTile(tx: number, ty: number): Promise<Buffer | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(TILE_URL(tx, ty), {
      headers: { "User-Agent": UA, Accept: "image/png" },
      signal: controller.signal,
    });
    if (!res.ok) return null; // 404 = blank tile, treat as all-transparent
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Read the live canvas over a project's rectangle as raw RGBA. The rectangle
 * can straddle tile boundaries, so we fetch every spanned tile and blit the
 * overlapping slice into one `width × height` buffer. Blank/missing tiles leave
 * their region transparent, which `diffPixels` reads as "not painted".
 */
export async function fetchLiveRegion(project: {
  tile_x: number;
  tile_y: number;
  offset_x: number;
  offset_y: number;
  width: number;
  height: number;
}): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  const { width: w, height: h } = project;
  const gx0 = project.tile_x * TILE + project.offset_x;
  const gy0 = project.tile_y * TILE + project.offset_y;
  const out = Buffer.alloc(w * h * 4); // zeroed → transparent by default

  const tx0 = Math.floor(gx0 / TILE);
  const tx1 = Math.floor((gx0 + w - 1) / TILE);
  const ty0 = Math.floor(gy0 / TILE);
  const ty1 = Math.floor((gy0 + h - 1) / TILE);

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      // Intersection of the project rect with this tile, in tile-local coords.
      const localX0 = Math.max(gx0, tx * TILE) - tx * TILE;
      const localY0 = Math.max(gy0, ty * TILE) - ty * TILE;
      const cw = Math.min(gx0 + w, (tx + 1) * TILE) - tx * TILE - localX0;
      const ch = Math.min(gy0 + h, (ty + 1) * TILE) - ty * TILE - localY0;
      if (cw <= 0 || ch <= 0) continue;

      const png = await fetchTile(tx, ty);
      if (!png) continue; // blank tile → leave region transparent

      const { data } = await sharp(png)
        .ensureAlpha()
        .extract({ left: localX0, top: localY0, width: cw, height: ch })
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Blit each row into the output buffer at its destination offset.
      const destX0 = tx * TILE + localX0 - gx0;
      const destY0 = ty * TILE + localY0 - gy0;
      for (let row = 0; row < ch; row++) {
        const srcStart = row * cw * 4;
        const destStart = ((destY0 + row) * w + destX0) * 4;
        data.copy(out, destStart, srcStart, srcStart + cw * 4);
      }
    }
  }
  return out;
}

/** Decode a stored template PNG to raw RGBA at its native dimensions. */
export async function templateToRaw(
  png: Buffer,
): Promise<{ data: Buffer; width: number; height: number }> {
  const { default: sharp } = await import("sharp");
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

// ── persistence ────────────────────────────────────────────────────────────

export async function listProjects(): Promise<WplaceProject[]> {
  return (await sql`
    select id, slug, title, tile_x, tile_y, offset_x, offset_y, width, height, author, source_url, created_at
    from wplace_projects
    order by created_at
  `) as WplaceProject[];
}

export async function getProjectBySlug(
  slug: string,
): Promise<WplaceProject | null> {
  const rows = (await sql`
    select id, slug, title, tile_x, tile_y, offset_x, offset_y, width, height, author, source_url, created_at
    from wplace_projects where slug = ${slug}
  `) as WplaceProject[];
  return rows[0] ?? null;
}

export async function getTemplatePng(id: string): Promise<Buffer | null> {
  const rows = (await sql`
    select template_png from wplace_projects where id = ${id}
  `) as { template_png: Buffer }[];
  return rows[0]?.template_png ?? null;
}

// ── rendering (for the dashboard) ────────────────────────────────────────────

export type RenderView = "live" | "template" | "diff";

// Diff overlay palette: what a pixel looks like in the "diff" view.
const GREY = [51, 51, 51, 255]; // tracked but unpainted (missing)
const RED = [220, 38, 38, 255]; // painted the wrong colour (griefed)

/** Nearest-neighbour scale a raw RGBA buffer up to a crisp PNG (pixels stay square). */
async function rasterToPng(
  raw: Buffer | Uint8Array,
  width: number,
  height: number,
  scale: number,
): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  return sharp(Buffer.from(raw), { raw: { width, height, channels: 4 } })
    .resize(width * scale, height * scale, { kernel: "nearest" })
    .png()
    .toBuffer();
}

/**
 * Render a project as a PNG for the dashboard, upscaled so each canvas pixel is
 * a visible block. `view`:
 *   - "template" → the target art
 *   - "live"     → what's currently painted on the canvas
 *   - "diff"     → live art, but wrong pixels flagged red and unpainted ones grey
 */
export async function renderProjectPng(
  project: WplaceProject,
  view: RenderView,
  scale = 6,
): Promise<Buffer | null> {
  const png = await getTemplatePng(project.id);
  if (!png) return null;
  const { width: w, height: h } = project;

  if (view === "template") {
    const { data } = await templateToRaw(png);
    return rasterToPng(data, w, h, scale);
  }

  const [{ data: template }, live] = await Promise.all([
    templateToRaw(png),
    fetchLiveRegion(project),
  ]);
  if (view === "live") return rasterToPng(live, w, h, scale);

  // "diff": start from the live canvas, then recolour tracked pixels by status.
  const out = Buffer.from(live);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    if (template[o + 3] < 128) {
      out[o + 3] = 0; // untracked → transparent
      continue;
    }
    if (
      template[o] === IGNORE.r &&
      template[o + 1] === IGNORE.g &&
      template[o + 2] === IGNORE.b
    ) {
      out[o + 3] = 0;
      continue;
    }
    const painted = live[o + 3] >= 128;
    const matches =
      painted &&
      live[o] === template[o] &&
      live[o + 1] === template[o + 1] &&
      live[o + 2] === template[o + 2];
    if (matches) continue; // keep the real colour
    out.set(painted ? RED : GREY, o);
  }
  return rasterToPng(out, w, h, scale);
}

export async function listSnapshots(
  projectId: string,
  limit = 500,
): Promise<WplaceSnapshot[]> {
  return (await sql`
    select id, project_id, taken_at, total_px, correct_px, wrong_px, missing_px, percent
    from wplace_snapshots
    where project_id = ${projectId}
    order by taken_at
    limit ${limit}
  `) as WplaceSnapshot[];
}

/**
 * Fetch the live canvas for a project, diff it against the stored template, and
 * append one snapshot row. Returns the diff (or null if the template is gone).
 */
export async function takeSnapshot(
  project: WplaceProject,
): Promise<DiffResult | null> {
  const png = await getTemplatePng(project.id);
  if (!png) return null;

  const [{ data: template }, live] = await Promise.all([
    templateToRaw(png),
    fetchLiveRegion(project),
  ]);
  const diff = diffPixels(template, live, project.width, project.height);

  await sql`
    insert into wplace_snapshots (project_id, total_px, correct_px, wrong_px, missing_px, percent)
    values (${project.id}, ${diff.total}, ${diff.correct}, ${diff.wrong}, ${diff.missing}, ${diff.percent})
  `;
  return diff;
}

// ── geo: canvas coords → a deep link into wplace.live ────────────────────────

/**
 * Convert a project's top-left anchor (tile + in-tile offset) to WGS84
 * lat/lng. The wplace canvas is a Web-Mercator projection tiled `GRID×GRID`
 * with `TILE` painted pixels per tile, so the whole world is `GRID*TILE` pixels
 * across. This is the inverse of the standard slippy-map pixel projection.
 */
export function canvasLatLng(project: {
  tile_x: number;
  tile_y: number;
  offset_x: number;
  offset_y: number;
}): { lat: number; lng: number } {
  const mapSize = GRID * TILE;
  const gx = project.tile_x * TILE + project.offset_x;
  const gy = project.tile_y * TILE + project.offset_y;
  const lng = (gx / mapSize) * 360 - 180;
  const n = Math.PI - 2 * Math.PI * (gy / mapSize);
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lat, lng };
}

/** A shareable wplace.live URL centred on the project's top-left anchor. */
export function wplaceLink(
  project: { tile_x: number; tile_y: number; offset_x: number; offset_y: number },
  zoom = 14,
): string {
  const { lat, lng } = canvasLatLng(project);
  return `https://wplace.live/?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}&zoom=${zoom}`;
}

// ── colour composition of a template ─────────────────────────────────────────

export interface ColorCount {
  hex: string; // "#rrggbb"
  count: number; // tracked template pixels of this colour
}

const toHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");

/**
 * Break a project's template down by colour: how many tracked pixels each
 * palette colour occupies, most-used first. Network-free (decodes the stored
 * template only), so it's cheap enough to run on every page render.
 */
export async function templateColors(project: WplaceProject): Promise<ColorCount[]> {
  const png = await getTemplatePng(project.id);
  if (!png) return [];
  const { data, width, height } = await templateToRaw(png);
  const counts = new Map<string, number>();
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    if (data[o + 3] < 128) continue; // transparent → untracked
    if (data[o] === IGNORE.r && data[o + 1] === IGNORE.g && data[o + 2] === IGNORE.b)
      continue;
    const hex = toHex(data[o], data[o + 1], data[o + 2]);
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([hex, count]) => ({ hex, count }))
    .sort((a, b) => b.count - a.count);
}

// ── alerts: derive banners from the snapshot history ─────────────────────────

export type AlertLevel = "success" | "info" | "warn" | "danger";
export interface WplaceAlert {
  level: AlertLevel;
  message: string;
}

// Tuned by feel — wplace tiles refresh on a delay and we sample every ~15 min,
// so one "step" below is roughly a quarter-hour.
const VANDAL_ABS = 5; // min extra wrong pixels for a jump to register
const VANDAL_REL = 1.2; // …and it must be ≥20% more than before
const STALL_STEPS = 3; // no progress across this many checks ⇒ "stalled"
const NEAR_DONE = 99; // percent

/**
 * Turn a project's snapshot series into zero or more banners. Pure, so it's
 * unit-testable. Ordered most- to least-urgent; the page shows them in order.
 */
export function deriveAlerts(snaps: WplaceSnapshot[]): WplaceAlert[] {
  const alerts: WplaceAlert[] = [];
  if (snaps.length === 0) return alerts;
  const latest = snaps[snaps.length - 1];
  const prev = snaps[snaps.length - 2];

  const done = latest.total_px > 0 && latest.correct_px === latest.total_px;

  // Vandalism — a sharp jump in wrong pixels since the last check…
  let flaggedVandalism = false;
  if (prev && latest.wrong_px - prev.wrong_px >= VANDAL_ABS &&
      latest.wrong_px >= Math.max(1, prev.wrong_px) * VANDAL_REL) {
    flaggedVandalism = true;
    alerts.push({
      level: "danger",
      message: `Possible vandalism — wrong pixels jumped +${latest.wrong_px - prev.wrong_px} since the last check (${prev.wrong_px} → ${latest.wrong_px}).`,
    });
  }
  // …or a sustained climb across three checks in a row.
  if (!flaggedVandalism && snaps.length >= 3) {
    const [a, b, c] = snaps.slice(-3);
    if (a.wrong_px < b.wrong_px && b.wrong_px < c.wrong_px && c.wrong_px - a.wrong_px >= VANDAL_ABS) {
      alerts.push({
        level: "danger",
        message: `Wrong pixels rising three checks straight (${a.wrong_px} → ${b.wrong_px} → ${c.wrong_px}) — likely active griefing.`,
      });
    }
  }

  // Correct pixels were overwritten (someone painted over finished work).
  if (prev && latest.correct_px < prev.correct_px) {
    const drop = prev.correct_px - latest.correct_px;
    alerts.push({
      level: "warn",
      message: `${drop} correct pixel${drop === 1 ? "" : "s"} overwritten since the last check.`,
    });
  }

  // Standing errors on the canvas (independent of whether they're rising).
  if (!done && latest.wrong_px > 0) {
    alerts.push({
      level: "warn",
      message: `${latest.wrong_px} wrong pixel${latest.wrong_px === 1 ? "" : "s"} currently off-template.`,
    });
  }

  // Milestones.
  if (done) {
    alerts.push({ level: "success", message: "Complete — every tracked pixel matches the template. 🎉" });
  } else if (latest.percent >= NEAR_DONE) {
    alerts.push({
      level: "info",
      message: `Almost there — ${latest.percent.toFixed(1)}% done, ${latest.missing_px} pixel${latest.missing_px === 1 ? "" : "s"} left.`,
    });
  }

  // Stalled — no new correct pixels across the last few checks while unfinished.
  if (!done && snaps.length > STALL_STEPS) {
    const window = snaps.slice(-(STALL_STEPS + 1));
    if (window.every((s) => s.correct_px === latest.correct_px) && latest.percent < NEAR_DONE) {
      alerts.push({
        level: "info",
        message: `Progress stalled — no new pixels across the last ${STALL_STEPS} checks.`,
      });
    }
  }

  return alerts;
}

/**
 * When the canvas last changed (correct or wrong count moved). Returns the ISO
 * time of the first snapshot at the current state, plus how many consecutive
 * checks have shown no change. Null if there isn't enough history to tell.
 */
export function idleSince(
  snaps: WplaceSnapshot[],
): { since: string; steps: number } | null {
  if (snaps.length < 2) return null;
  const latest = snaps[snaps.length - 1];
  for (let i = snaps.length - 2; i >= 0; i--) {
    if (snaps[i].correct_px !== latest.correct_px || snaps[i].wrong_px !== latest.wrong_px) {
      return { since: snaps[i + 1].taken_at, steps: snaps.length - 1 - i };
    }
  }
  return { since: snaps[0].taken_at, steps: snaps.length - 1 };
}
