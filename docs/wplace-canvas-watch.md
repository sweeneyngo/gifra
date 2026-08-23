# Spec — wplace "Canvas Watch" (`/wplace`)

**Status:** built + tracking (love-baba) · insight/alerts layer added · **Surface:** `/wplace` · **Added:** 2026-08-22

## 1. Summary

A read-only dashboard that tracks pixel-art drawings pinned to the
[wplace.live](https://wplace.live) world canvas and charts their **completion
over time**. It answers "how done is my drawing, and is anyone griefing it?" —
it is explicitly **not** a drawing/placement tool.

Placement is handled off-site by the [Blue Marble](https://github.com/SwingTheVine/Wplace-BlueMarble)
overlay userscript. This feature only *reads* the canvas.

## 2. Goals / non-goals

**Goals**
- Track one or more drawings, each pinned at a known location on the canvas.
- Sample progress on a schedule and retain a time series.
- Show, per drawing: % complete, a target-vs-live visual, correct/wrong/unpainted
  counts, and a progress-over-time chart.
- Zero new runtime dependencies; reuse the existing stack (Next.js + Neon + `sharp`).

**Non-goals**
- Automating pixel placement (bots) — out of scope and against the spirit of wplace.
- An in-app editor or template designer.
- Real-time (sub-minute) updates — wplace tiles update on a delay; ~15 min is fine.
- Multi-user accounts / auth on the dashboard (it's a public read-only page).

## 3. Background: how wplace exposes the canvas

There is **no official API**. The canvas is served as static PNG tiles:

```
https://backend.wplace.live/files/s0/tiles/{tileX}/{tileY}.png
```

- Tile grid is **2048 × 2048** (Web-Mercator, base zoom 11).
- Each tile is **1000 × 1000** painted pixels (`TILE = 1000`).
- A pixel's global position is `tile * 1000 + offset`; coordinates are **relative
  to the tile**, so a location is `(tileX, tileY, offsetX, offsetY)`.
- Never-painted tiles return **404** → treated as fully transparent (unpainted).
- The backend sits behind Cloudflare: requests send a browser `User-Agent`,
  responses are cached, and polling is deliberately infrequent.

## 4. Architecture

```
scripts/wplace-add.ts ──insert──▶ wplace_projects (template PNG + coords)
                                        │
Vercel Cron (15m) ─▶ /api/wplace/cron ──┤ for each project:
                                        │   fetch tiles → stitch → diff template
                                        └─▶ wplace_snapshots (numeric row)

/wplace page ──reads──▶ wplace_projects + wplace_snapshots
     │  renders headline %, stat row, SVG chart
     └─▶ <img> /api/wplace/[slug]/render?view=template|live|diff  (PNG, on demand)
```

All logic lives in [`src/lib/wplace.ts`](../src/lib/wplace.ts); routes and the page
are thin wrappers over it.

## 5. Data model

Two tables, added to `scripts/db-init.mjs` (idempotent `create table if not exists`).

### `wplace_projects` — one row per tracked drawing
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `slug` | text unique | URL/CLI identifier |
| `title` | text | display label (nullable) |
| `tile_x`, `tile_y` | integer | top-left pixel's tile |
| `offset_x`, `offset_y` | integer | top-left pixel's in-tile offset (0–999) |
| `width`, `height` | integer | template dimensions in canvas pixels |
| `author` | text | who drew it (nullable, attribution) |
| `source_url` | text | link to the original art/artist (nullable) |
| `template_png` | bytea | the palette-quantized target image, stored inline |
| `created_at` | timestamptz | |

`author`/`source_url` are added via idempotent `alter table … add column if not exists`
so the migration is safe to re-run on an existing database.

`template_png` is stored **inline** because templates are tiny (pixel art, a few
KB); no object storage needed.

### `wplace_snapshots` — one row per sample
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `project_id` | uuid fk → projects | `on delete cascade` |
| `taken_at` | timestamptz | sample time |
| `total_px` | integer | tracked (non-ignored) template pixels |
| `correct_px` | integer | painted with the target colour |
| `wrong_px` | integer | painted a different colour (griefed) |
| `missing_px` | integer | not yet painted |
| `percent` | real | `correct / total * 100` |

Index `wplace_snapshots_project_time (project_id, taken_at desc)`.

Snapshots are **pure numbers** — no rendered images persisted. Any visual is
regenerated on demand from the live canvas.

## 6. Core library (`src/lib/wplace.ts`)

### Diff accounting — `diffPixels(template, live, w, h) → DiffResult`
Pure, network-free (unit-tested). For each pixel of two same-size raw RGBA buffers:
- **Skip** template pixels that are transparent (alpha < 128) **or** the `#deface`
  sentinel → "outside the design," untracked. (`#deface` is the Blue Marble
  convention for transparency, since the wplace palette has a real transparent swatch.)
- Otherwise it counts toward `total`, then:
  - live alpha < 128 → **missing** (blank canvas, not yet painted)
  - live RGB == template RGB → **correct**
  - else → **wrong** (griefed / mismatched)
- `percent = total ? correct/total*100 : 0` (guards `NaN` when nothing is tracked).

### Tile fetch + stitch — `fetchLiveRegion(project) → Buffer (raw RGBA, w*h*4)`
- Computes the tile range the rectangle spans on each axis.
- Fetches each tile (`fetchTile`, 8s timeout, browser UA; 404/error → null → region
  left transparent).
- Extracts the overlapping slice of each tile with `sharp(...).extract(...)` and
  blits it row-by-row into one `w×h` output buffer.
- Handles art that straddles tile boundaries transparently.

### Snapshot — `takeSnapshot(project) → DiffResult | null`
Loads the template, fetches the live region, diffs them, inserts one snapshot row.
Returns null if the template is missing.

### Rendering — `renderProjectPng(project, view, scale=6) → Buffer | null`
Nearest-neighbour upscales (each canvas pixel → a `scale`×`scale` block) to a PNG.
- `template` — the target art.
- `live` — what's currently painted.
- `diff` — the live art, but tracked pixels recoloured: **red** where wrong,
  **grey** where unpainted, real colour where correct, transparent where untracked.

### Derived insight (pure, unit-tested)
All computed from the numeric snapshot series (or the stored template) — no extra
network calls, so they're cheap enough to run on every page render:
- `deriveAlerts(snapshots) → WplaceAlert[]` — banners by severity. **Vandalism**
  (`danger`): wrong pixels jump ≥5 **and** ≥20% since the last check, or climb three
  checks straight. **Overwrite** (`warn`): correct count dropped. **Standing errors**
  (`warn`): any wrong pixels. **Milestones**: complete (`success`) / ≥99% (`info`).
  **Stalled** (`info`): no new correct pixels across the last 3 checks. Thresholds
  live at the top of the module (`VANDAL_ABS`, `VANDAL_REL`, `STALL_STEPS`, `NEAR_DONE`).
- `idleSince(snapshots)` — when the canvas last changed + how many checks it's held.
- `templateColors(project) → ColorCount[]` — the template's colour composition
  (tracked pixels per palette colour, most-used first).
- `canvasLatLng(project)` / `wplaceLink(project)` — invert the Web-Mercator pixel
  projection to a WGS84 lat/lng and build a `wplace.live/?lat=&lng=&zoom=` deep link
  to the drawing's top-left anchor.

## 7. Interfaces

### Ingest — `scripts/wplace-add.ts`
```
node --env-file=.env.local scripts/wplace-add.ts \
  --slug=kitty --title="Pixel Kitty" --author="@artist" --source=https://… \
  --tile=1100,670 --offset=512,240 --image=./kitty.png
```
- Reads `width`/`height` from the image itself (via `sharp`), so dimensions can't
  drift from the pixels being diffed.
- `--author`/`--source` are optional attribution, surfaced on the dashboard.
- Upserts by `slug` (`on conflict do update`), so re-running with a new `--image`
  swaps the template while **keeping snapshot history**.
- Also exposed as `npm run wplace:add -- …`.

### Cron — `GET /api/wplace/cron`
- Requires `Authorization: Bearer $CRON_SECRET`; returns **503** if `CRON_SECRET`
  is unset, **401** on mismatch.
- Iterates all projects, calls `takeSnapshot` for each; one project's failure is
  caught and reported without sinking the others.
- Scheduled by `vercel.json` → `*/15 * * * *`. `maxDuration = 60`.
- Returns `{ ok, count, results: [{ slug, percent | error }] }`.

### Render — `GET /api/wplace/[slug]/render?view=live|template|diff`
- Defaults to `live`; unknown `view` falls back to `live`.
- `?download=1` streams the **original 1:1 template PNG** as a file attachment
  (`Content-Disposition: attachment; filename="<slug>.png"`), for re-pinning/re-import.
- 404 if the slug or template is missing.
- `Cache-Control`: `template`/download 1h, `live`/`diff` 60s (polite + snappy).

### Page — `GET /wplace`
- Server component, `dynamic = "force-dynamic"`.
- Lists projects with their snapshot history. Per project: title/dimensions/tile +
  "updated Nm ago", headline %, **alert banners** (`deriveAlerts`), target + diff
  `<img>` renders, stat row (correct/wrong/remaining/total), an **activity line**
  (pixels left + idle time from `idleSince`), a **metadata row** (deep link to the
  anchor on wplace via `wplaceLink`, template download, author/source, added date),
  a **colour breakdown** (`templateColors`), and the SVG chart.
- Empty state points at the `wplace-add.ts` command.
- `ProgressChart.tsx` is a pure server-rendered SVG line+area chart (fixed Y 0–100%
  so projects are comparable; X spans first→last snapshot). Hand-rolled — no chart
  dependency, matching the music-waveform approach. Needs ≥2 snapshots to draw.
- Adds a **Canvas** tab to the shared nav; styles appended to `globals.css`
  (`.wp-*`), using existing theme variables (banners tint by severity; the intro
  link and metadata links use the amber accent).

## 8. Data flow (end to end)

1. Author quantizes the image to the wplace palette and pins it with Blue Marble
   to read off `tile`/`offset`.
2. `wplace-add.ts` stores the template + coords as a `wplace_projects` row.
3. Every 15 min, Vercel Cron calls `/api/wplace/cron`, which for each project
   fetches the live tile(s), diffs against the template, and appends a snapshot.
4. `/wplace` renders the latest snapshot's numbers + regenerated visuals and the
   full snapshot series as a chart.

## 9. Edge cases & decisions

- **Blank/404 tiles** → transparent → counted as `missing`, never `wrong`.
- **Boundary-crossing art** → multi-tile fetch + stitch into one buffer.
- **Nothing tracked** (`total = 0`) → `percent = 0`, not `NaN`.
- **Transparency vs. `#deface`** → both mean untracked; `#deface` lets a template
  mark holes without relying on the alpha channel.
- **Template inline as `bytea`** vs. object storage → chosen for simplicity; templates
  are tiny and there's exactly one per project.
- **Snapshots numeric-only** → cheap storage, fast charts; visuals regenerate on demand.
- **Cloudflare** → browser UA, short caches, 15-min cadence; no scraping of whole map.
- **Cron auth** → shared-secret bearer; endpoint disabled unless `CRON_SECRET` set.

## 10. Testing

`src/lib/wplace.test.ts` (Vitest) covers the pure logic against fixtures: diff
accounting (fully-painted = 100%; correct/wrong/missing classification; ignore
transparent + `#deface`; `total = 0 → 0%` no-NaN guard); `deriveAlerts` (vandalism
jump + sustained climb, overwrite, completion, stalled, and non-triggers);
`idleSince` step counting; and `canvasLatLng`/`wplaceLink` against known
Web-Mercator reference points. Network/`sharp` paths are left to integration
(they're thin wrappers over well-tested libraries).

Repo checks all pass: `tsc --noEmit`, `vitest run` (81 tests), `next build`.

## 11. Configuration

| Env var | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres (already present) |
| `CRON_SECRET` | Bearer secret for `/api/wplace/cron`; unset ⇒ endpoint returns 503 |

Migration: `node --env-file=.env.local scripts/db-init.mjs` (creates the two tables
and adds the `author`/`source_url` columns; idempotent).

## 12. Future work

- **Off-app alerting** (e.g. Discord ping) when `deriveAlerts` raises a `danger`
  banner — the in-app banners exist; this would push them out.
- Per-*colour* live breakdown (correct/wrong/missing per palette colour), not just
  the template's colour composition — needs the live region, so compute at snapshot
  time and store as JSON rather than on every page load.
- Per-project detail page with a longer/zoomable history and a live-refresh toggle.
- Admin UI to add/retire projects (currently CLI-only).
- Downsample/prune very old snapshots if the series grows large.
```

## Files

| Path | Role |
|---|---|
| `src/lib/wplace.ts` | tile fetch/stitch, diff, snapshot, render, alerts, colours, geo link |
| `src/lib/wplace.test.ts` | diff-math unit tests |
| `scripts/db-init.mjs` | schema (two new tables) |
| `scripts/wplace-add.ts` | ingest CLI (`npm run wplace:add`) |
| `src/app/api/wplace/cron/route.ts` | scheduled sampler |
| `src/app/api/wplace/[slug]/render/route.ts` | PNG render endpoint |
| `src/app/wplace/page.tsx` | dashboard page |
| `src/app/wplace/ProgressChart.tsx` | SVG chart |
| `src/app/Nav.tsx` | Canvas nav tab |
| `src/app/globals.css` | `.wp-*` styles |
| `vercel.json` | cron schedule |
