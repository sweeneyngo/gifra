// pywal-ish: pull vibrant accent candidates out of public/banner.jpg.
import sharp from "sharp";

const { data, info } = await sharp("public/banner.jpg")
  .resize(240)
  .raw()
  .toBuffer({ resolveWithObject: true });
const ch = info.channels;

function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}
function hsl2hex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

// Weight vibrant, mid-bright pixels; bin by hue.
const bins = new Array(36).fill(0).map(() => ({ w: 0, h: 0, s: 0, l: 0 }));
for (let i = 0; i < data.length; i += ch) {
  const [h, s, l] = rgb2hsl(data[i], data[i + 1], data[i + 2]);
  if (l < 0.18 || l > 0.9 || s < 0.22) continue; // skip dark/washed/gray
  const weight = s * (1 - Math.abs(l - 0.55)); // favor saturated & mid-bright
  const b = Math.floor(h / 10) % 36;
  bins[b].w += weight;
  bins[b].h += h * weight;
  bins[b].s += s * weight;
  bins[b].l += l * weight;
}
const ranked = bins
  .filter((b) => b.w > 0)
  .map((b) => ({ h: b.h / b.w, s: b.s / b.w, l: b.l / b.w, w: b.w }))
  .sort((a, b) => b.w - a.w);

const total = ranked.reduce((t, b) => t + b.w, 0);
console.log("Top vibrant hues in banner.jpg:");
for (const b of ranked.slice(0, 6)) {
  const raw = hsl2hex(b.h, b.s, b.l);
  // Accent-tuned: bump saturation, set lightness for dark-bg legibility.
  const accent = hsl2hex(b.h, Math.min(1, b.s * 1.15), 0.62);
  console.log(
    `  hue ${b.h.toFixed(0).padStart(3)}°  share ${((b.w / total) * 100).toFixed(0).padStart(2)}%  raw ${raw}  accent→ ${accent}`,
  );
}
