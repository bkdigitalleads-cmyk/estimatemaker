const sharp = require('sharp');
const opentype = require('opentype.js');
const fs = require('fs');
const path = require('path');

// App Store screenshots, built from the app's real screens (store/screens,
// rendered at 3x, or another folder of the same names: `node screenshots.js
// <dir>`). Each is the app's manila background, a short caption at the top
// in the app's own condensed type (IBM Plex Sans Condensed SemiBold, drawn
// as outlines so it looks the same anywhere), and under it the whole screen
// with rounded corners, or a cut of it (`crop`, top and height as shares of
// the screen) shown larger. No device frames, gradients or emoji. Captions
// carry the search terms. Writes store/screenshots/6.3/ (1206x2622) and
// 6.9/ (1320x2868).

const ROOT = path.join(__dirname, '..');
const SRC = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, 'screens');
const FONT = opentype.loadSync(path.join(ROOT, 'assets/fonts/IBMPlexSansCondensed-SemiBold.ttf'));
const BOARD = '#EEE8DC';
const INK = '#1C1B19';
const ORANGE = '#C9480B';
const EDGE = 'rgba(28,27,25,0.14)';

const SHOTS = [
  { file: 'preview', caption: 'Estimate Maker for Your Business' },
  { file: 'editor', caption: 'Quotes and Estimates in Minutes' },
  { file: 'home', caption: 'Invoice and Receipt in One Tap' },
  { file: 'sign', caption: 'Signed on the Spot' },
  { file: 'totals', caption: 'Totals, Tax and Deposits', crop: { top: 0.13, height: 0.78 } },
  { file: 'banner', caption: 'Three Clean PDF Templates' },
];

const SIZES = [
  { name: '6.3', width: 1206, height: 2622 },
  { name: '6.9', width: 1320, height: 2868 },
];

/** The caption as one or two centred lines, as large as fits, with a short orange rule under it. */
function captionSvg(text, width, top, maxSize) {
  const maxW = width * 0.86;
  const widthAt = (t, size) => FONT.getAdvanceWidth(t, size);
  let lines = [text];
  let size = maxSize;
  if (widthAt(text, size) > maxW) {
    const words = text.split(' ');
    let best = 1;
    let bestDiff = Infinity;
    for (let i = 1; i < words.length; i++) {
      const d = Math.abs(widthAt(words.slice(0, i).join(' '), maxSize) - widthAt(words.slice(i).join(' '), maxSize));
      if (d < bestDiff) {
        bestDiff = d;
        best = i;
      }
    }
    lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
    while (lines.some((l) => widthAt(l, size) > maxW)) size -= 2;
  }
  const lineH = size * 1.06;
  const paths = lines
    .map((l, i) => `<path d="${FONT.getPath(l, (width - widthAt(l, size)) / 2, top + size + i * lineH, size).toPathData(2)}" fill="${INK}"/>`)
    .join('');
  const ruleY = top + size + (lines.length - 1) * lineH + size * 0.42;
  const rule = `<rect x="${width / 2 - size * 0.6}" y="${ruleY}" width="${size * 1.2}" height="${Math.max(6, size * 0.07)}" rx="3" fill="${ORANGE}"/>`;
  return { paths: paths + rule, bottom: ruleY + size * 0.1 };
}

async function one(shot, size) {
  const k = size.width / 1320;
  const cap = captionSvg(shot.caption, size.width, Math.round(150 * k), Math.round(124 * k));
  const src = path.join(SRC, `${shot.file}.png`);
  const meta = await sharp(src).metadata();
  let input = sharp(src);
  let aspect = meta.width / meta.height;
  if (shot.crop) {
    const top = Math.round(meta.height * shot.crop.top);
    const h = Math.round(meta.height * shot.crop.height);
    input = sharp(await sharp(src).extract({ left: 0, top, width: meta.width, height: h }).png().toBuffer());
    aspect = meta.width / h;
  }
  const top = Math.round(Math.max(cap.bottom + 80 * k, 470 * k));
  const availH = size.height - top - Math.round(80 * k);
  let screenH = availH;
  let screenW = Math.round(screenH * aspect);
  const maxW = Math.round(size.width * (shot.crop ? 0.9 : 0.84));
  if (screenW > maxW) {
    screenW = maxW;
    screenH = Math.round(screenW / aspect);
  }
  const left = Math.round((size.width - screenW) / 2);
  const y = top + Math.round((availH - screenH) / 2);
  const r = Math.round(screenW * (shot.crop ? 0.05 : 55 / 393));
  const screen = await input.resize(screenW, screenH, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer();
  const mask = Buffer.from(`<svg width="${screenW}" height="${screenH}"><rect width="${screenW}" height="${screenH}" rx="${r}" fill="#fff"/></svg>`);
  const rounded = await sharp(screen).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  const bg = `<svg width="${size.width}" height="${size.height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size.width}" height="${size.height}" fill="${BOARD}"/>
    ${cap.paths}
    <rect x="${left - 2}" y="${y - 2}" width="${screenW + 4}" height="${screenH + 4}" rx="${r + 2}" fill="${EDGE}"/>
  </svg>`;
  return sharp(Buffer.from(bg)).composite([{ input: rounded, left, top: y }]).flatten({ background: BOARD }).png({ compressionLevel: 9 }).toBuffer();
}

(async () => {
  for (const size of SIZES) {
    const dir = path.join(__dirname, 'screenshots', size.name);
    fs.mkdirSync(dir, { recursive: true });
    for (let i = 0; i < SHOTS.length; i++) {
      const out = path.join(dir, `${i + 1}-${SHOTS[i].caption.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')}.png`);
      const buf = await one(SHOTS[i], size);
      const m = await sharp(buf).metadata();
      if (m.width !== size.width || m.height !== size.height) throw new Error(`${out} is ${m.width}x${m.height}`);
      fs.writeFileSync(out, buf);
      console.log(path.relative(ROOT, out), `${m.width}x${m.height}`);
    }
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
