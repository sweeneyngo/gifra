// Register a wplace drawing to track, or refresh an existing one's template.
//
//   node --env-file=.env.local scripts/wplace-add.ts \
//     --slug=kitty --title="Pixel Kitty" \
//     --tile=1100,670 --offset=512,240 --image=./kitty.png
//
// The template PNG must already be quantized to the wplace palette (use a tool
// like wplacetool.com), sized exactly as it appears on the canvas — one image
// pixel = one canvas pixel. Use #deface (or transparency) for pixels outside
// the design. `--tile` and `--offset` are the top-left pixel's tile coordinates
// and in-tile offset, which Blue Marble fills in for you when you pin the image.
//
// Upserts by slug, so re-running with a new --image just swaps the template
// while keeping the collected snapshot history intact.
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}
function pair(name: string): [number, number] | undefined {
  const v = arg(name);
  if (!v) return undefined;
  const [a, b] = v.split(",").map((n) => Number(n.trim()));
  return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : undefined;
}

const slug = arg("slug");
const image = arg("image");
const tile = pair("tile");
const offset = pair("offset");
const title = arg("title") ?? null;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set (use --env-file=.env.local).");
  process.exit(1);
}
if (!slug || !image || !tile || !offset) {
  console.error(
    "Usage: node --env-file=.env.local scripts/wplace-add.ts \\\n" +
      '  --slug=<id> [--title="..."] --tile=<tileX,tileY> --offset=<pxX,pxY> --image=<file.png>',
  );
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const png = readFileSync(image);

// Measure the template so width/height come straight from the image — no chance
// of them drifting out of sync with the pixels we later diff against.
const sharp = (await import("sharp")).default;
const meta = await sharp(png).metadata();
const width = meta.width ?? 0;
const height = meta.height ?? 0;
if (!width || !height) {
  console.error(`Could not read dimensions from ${image}.`);
  process.exit(1);
}

await sql`
  insert into wplace_projects (slug, title, tile_x, tile_y, offset_x, offset_y, width, height, template_png)
  values (${slug}, ${title}, ${tile[0]}, ${tile[1]}, ${offset[0]}, ${offset[1]}, ${width}, ${height}, ${png})
  on conflict (slug) do update set
    title = excluded.title,
    tile_x = excluded.tile_x,
    tile_y = excluded.tile_y,
    offset_x = excluded.offset_x,
    offset_y = excluded.offset_y,
    width = excluded.width,
    height = excluded.height,
    template_png = excluded.template_png
`;

console.log(
  `✅ ${slug}: ${width}×${height} at tile ${tile[0]},${tile[1]} + ${offset[0]},${offset[1]} (${png.length} B template).`,
);
