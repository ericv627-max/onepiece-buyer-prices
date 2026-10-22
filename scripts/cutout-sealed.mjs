// Cuts the white studio background out of sealed product photos (booster boxes, packs, decks) so they sit on the
// dark site instead of in a white rectangle. Writes public/sealed/<productId>.webp and data/cutouts.json.
//
//   node scripts/cutout-sealed.mjs          only products without a cutout yet
//   node scripts/cutout-sealed.mjs --all    redo every one
//
// How: flood-fill from the picture's edges through near-white pixels, so white areas INSIDE the product (a white box,
// a white label) are kept because the fill can't reach them. Edge pixels that are almost white get partial
// transparency for a soft edge. A result that removed almost nothing or almost everything is rejected, and that
// product keeps the light plate the site uses for sealed photos without a cutout.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'public', 'sealed');
const LIST = path.join(root, 'data', 'cutouts.json');
const all = process.argv.includes('--all');
const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const minShare = Number(arg('--min-share') ?? 0.04);       // less background than this: treat as a full-bleed photo
const only = arg('--only')?.split(',').map(Number);           // limit a run to these product ids

const catalog = JSON.parse(readFileSync(path.join(root, 'data', 'catalog.json'), 'utf8')).cards;
const sealed = new Map();
for (const c of catalog) if (c.kind === 'sealed' && c.image_url && !sealed.has(c.product_id)) sealed.set(c.product_id, c.image_url);
const done = existsSync(LIST) ? JSON.parse(readFileSync(LIST, 'utf8')) : { cutouts: [] };
const have = new Set(done.cutouts);
mkdirSync(OUT, { recursive: true });

const HARD = 244;   // a pixel this bright on every channel, and grey, is background
const SOFT = 226;   // between SOFT and HARD at the boundary: partly transparent

async function cutout(id, url) {
  // TCGplayer keeps a 1000px version of most photos; the 400px one looks soft once the background is gone.
  const big = url.replace(/_(?:200|400)w\.jpg$/, '_in_1000x1000.jpg');
  let res = await fetch(big, { headers: { 'User-Agent': 'HOLOMARK/1.0' } });
  if (!res.ok) res = await fetch(url, { headers: { 'User-Agent': 'HOLOMARK/1.0' } });
  if (!res.ok) return `download ${res.status}`;
  const { data, info } = await sharp(Buffer.from(await res.arrayBuffer())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = i => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
  const whiteness = i => { const [r, g, b] = px(i); return Math.max(r, g, b) - Math.min(r, g, b) > 14 ? 0 : Math.min(r, g, b); };

  const bg = new Uint8Array(w * h);
  const stack = [];
  const seed = i => { if (!bg[i] && whiteness(i) >= HARD) { bg[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop(), x = i % w, y = (i / w) | 0;
    if (x > 0) seed(i - 1); if (x < w - 1) seed(i + 1); if (y > 0) seed(i - w); if (y < h - 1) seed(i + w);
  }
  let removed = 0;
  for (let i = 0; i < w * h; i++) if (bg[i]) { data[i * 4 + 3] = 0; removed++; }
  const share = removed / (w * h);
  if (share < minShare || share > 0.9) return `rejected (${Math.round(share * 100)}% background)`;

  // soften the boundary: product pixels next to the background that are nearly white fade out a little
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (bg[i] || !(bg[i - 1] || bg[i + 1] || bg[i - w] || bg[i + w])) continue;
    const v = whiteness(i);
    if (v > SOFT) data[i * 4 + 3] = Math.round(255 * (HARD - v) / (HARD - SOFT));
  }

  // What's left can be several separate pieces. Case photos carry a quantity badge ("x12": a dark disc beside the
  // box), and the edges leave specks. Drop specks, and drop any piece that is a small dark disc; keep everything
  // else, since some products really are several pieces (a deck set, a gift collection).
  const label = new Int32Array(w * h).fill(-1);
  const pieces = [];
  for (let s = 0; s < w * h; s++) {
    if (label[s] !== -1 || data[s * 4 + 3] === 0) continue;
    const id2 = pieces.length, members = [s];
    label[s] = id2;
    let minX = w, minY = h, maxX = 0, maxY = 0, lum = 0;
    for (let k = 0; k < members.length; k++) {
      const i = members[k], x = i % w, y = (i / w) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      lum += (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
      for (const j of [i - 1, i + 1, i - w, i + w, i - w - 1, i - w + 1, i + w - 1, i + w + 1]) {
        if (j < 0 || j >= w * h || Math.abs((j % w) - x) > 1) continue;
        if (label[j] === -1 && data[j * 4 + 3] > 0) { label[j] = id2; members.push(j); }
      }
    }
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    pieces.push({ members, area: members.length, dark: lum / members.length < 70, round: Math.abs(bw / bh - 1) < 0.2 && Math.abs(members.length / (bw * bh) - Math.PI / 4) < 0.12 });
  }
  const largest = Math.max(...pieces.map(p => p.area));
  let badges = 0;
  for (const p of pieces) {
    const speck = p.area < largest * 0.004;
    const badge = p.dark && p.round && p.area < largest * 0.25;
    if (speck || badge) { for (const i of p.members) data[i * 4 + 3] = 0; if (badge) badges++; }
  }

  await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .trim({ threshold: 1 })
    .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 84, alphaQuality: 90 })
    .toFile(path.join(OUT, `${id}.webp`));
  return badges ? `ok, badge removed` : 'ok';
}

const todo = [...sealed].filter(([id]) => (only ? only.includes(id) : all || !have.has(id)));
let i = 0;
const results = {};
async function worker() {
  while (i < todo.length) {
    const [id, url] = todo[i++];
    try { results[id] = await cutout(id, url); } catch (e) { results[id] = 'error ' + e.message; }
    if (results[id].startsWith('ok')) have.add(id); else have.delete(id);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
writeFileSync(LIST, JSON.stringify({ cutouts: [...have].sort((a, b) => a - b) }) + '\n');
const fails = Object.entries(results).filter(([, r]) => !r.startsWith('ok'));
console.log(`quantity badges removed: ${Object.values(results).filter(r => r === 'ok, badge removed').length}`);
console.log(`cutouts: ${todo.length - fails.length} made, ${fails.length} kept the plate; ${have.size} total`);
for (const [id, r] of fails.slice(0, 15)) console.log('  ', id, r);
