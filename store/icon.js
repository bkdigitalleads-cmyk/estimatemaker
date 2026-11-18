const sharp = require('sharp');
const opentype = require('opentype.js');
const path = require('path');
const fs = require('fs');

// Estimate Maker icon concepts, in the app's own palette (work-ticket paper,
// ink, tape-measure orange) and its own type (IBM Plex Sans Condensed and
// Plex Mono, SIL OFL), drawn as outlines so they look the same anywhere.
// `node icon.js options` writes docs/design/icon-options.png: each concept
// large, then at 60 px on a light and a dark wallpaper. `node icon.js`
// writes the chosen one to ../assets and the website.
//   ticket - a work ticket with a torn bottom edge, ruled lines and the total underlined
//   carbon - two sheets of a carbonless book, white over canary, the top one ruled
//   stamp  - "PAID" as a rubber stamp, tilted, in orange ink on paper
//   tag    - an orange tile with a paper slip, ruled lines and a check mark
// No currency sign (the app is for every currency), no wrench, hammer or hard hat.
const CHOSEN = 'ticket';

const ROOT = path.join(__dirname, '..');
const COND = opentype.loadSync(`${ROOT}/assets/fonts/IBMPlexSansCondensed-SemiBold.ttf`);
const PAPER = '#FBF8F1';
const INK = '#1C1B19';
const ORANGE = '#D9531E';
const CANARY = '#F2D675';
const RULE = '#D8D1C2';

function textPath(font, s, x, y, size, fill) {
  return `<path d="${font.getPath(s, x, y, size).toPathData(2)}" fill="${fill}"/>`;
}

/** A zigzag bottom edge, like a slip torn off a pad. */
function torn(x0, x1, y, n, h) {
  const w = (x1 - x0) / n;
  let d = '';
  for (let i = 0; i < n; i++) d += `L${x0 + w * i + w / 2} ${y + h} L${x0 + w * (i + 1)} ${y}`;
  return d;
}

const art = {
  ticket: () => {
    const n = 6;
    const w = 520 / n;
    let teeth = '';
    for (let i = 0; i < n; i++) teeth += `L${772 - w * i - w / 2} 846 L${772 - w * (i + 1)} 806`;
    return `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    <rect width="1024" height="1024" fill="${ORANGE}"/>
    <g transform="rotate(-6 512 512)">
      <path d="M252 168 H772 V806 ${teeth} Z" fill="${PAPER}"/>
      <rect x="318" y="262" width="230" height="54" rx="12" fill="${INK}"/>
      <rect x="318" y="392" width="388" height="26" rx="13" fill="${RULE}"/>
      <rect x="318" y="470" width="388" height="26" rx="13" fill="${RULE}"/>
      <rect x="318" y="548" width="270" height="26" rx="13" fill="${RULE}"/>
      <rect x="318" y="650" width="388" height="18" rx="9" fill="${INK}"/>
      <rect x="532" y="694" width="174" height="54" rx="12" fill="${ORANGE}"/>
    </g>
  </svg>`;
  },
  carbon: () => `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    <rect width="1024" height="1024" fill="#2B2A27"/>
    <rect x="270" y="220" width="520" height="640" rx="18" fill="${CANARY}" transform="rotate(6 530 540)"/>
    <rect x="234" y="170" width="520" height="640" rx="18" fill="${PAPER}"/>
    ${textPath(COND, 'EST', 290, 330, 150, ORANGE)}
    <rect x="290" y="420" width="408" height="16" rx="8" fill="${RULE}"/>
    <rect x="290" y="500" width="408" height="16" rx="8" fill="${RULE}"/>
    <rect x="290" y="580" width="300" height="16" rx="8" fill="${RULE}"/>
    <rect x="290" y="680" width="408" height="40" rx="10" fill="${INK}"/>
  </svg>`,
  stamp: () => `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    <rect width="1024" height="1024" fill="${PAPER}"/>
    <g transform="rotate(-12 512 512)">
      <rect x="150" y="352" width="724" height="320" rx="28" fill="none" stroke="${ORANGE}" stroke-width="40"/>
      ${textPath(COND, 'PAID', 0, 0, 1, ORANGE).replace(/<path d="[^"]*"/, () => `<path d="${COND.getPath('PAID', 512 - COND.getAdvanceWidth('PAID', 250) / 2, 602, 250).toPathData(2)}"`)}
    </g>
  </svg>`,
  tag: () => `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    <rect width="1024" height="1024" fill="${INK}"/>
    <rect x="250" y="190" width="524" height="644" rx="24" fill="${PAPER}"/>
    <rect x="320" y="290" width="384" height="20" rx="10" fill="${RULE}"/>
    <rect x="320" y="370" width="384" height="20" rx="10" fill="${RULE}"/>
    <rect x="320" y="450" width="260" height="20" rx="10" fill="${RULE}"/>
    <path d="M360 640 L460 730 L680 540" fill="none" stroke="${ORANGE}" stroke-width="64" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
};

async function tile(name, size) {
  return sharp(Buffer.from(art[name]())).resize(size, size).png().toBuffer();
}

/** iOS masks the icon to a rounded square; this is how it reads on a home screen. */
async function masked(name, size) {
  const r = Math.round(size * 0.2237);
  const mask = Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="#fff"/></svg>`);
  return sharp(await tile(name, size)).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

async function options() {
  const names = Object.keys(art);
  const W = 1800;
  const col = W / names.length;
  const H = 1060;
  const comps = [];
  const labels = [];
  const walls = [];
  for (let i = 0; i < names.length; i++) {
    const n = names[i];
    const x = Math.round(i * col + (col - 360) / 2);
    comps.push({ input: await masked(n, 360), left: x, top: 60 });
    labels.push(`<text x="${i * col + col / 2}" y="470" font-family="DejaVu Sans" font-size="30" text-anchor="middle" fill="#1C1B19">${i + 1}. ${n}${n === CHOSEN ? ' (chosen)' : ''}</text>`);
    // 60 px on a light and a dark wallpaper, next to two plain neighbours.
    for (const [j] of [['light'], ['dark']].entries()) {
      const top = 540 + j * 250;
      const wx = Math.round(i * col + 30);
      walls.push(`<rect x="${wx}" y="${top}" width="${Math.round(col - 60)}" height="210" rx="16" fill="url(#w${j})"/>`);
      const slots = [null, n, null];
      for (let s = 0; s < 3; s++) {
        const ix = wx + 40 + s * 120;
        const icon = slots[s] ? await masked(slots[s], 60) : await sharp(Buffer.from(`<svg width="60" height="60"><rect width="60" height="60" rx="13" fill="${s === 0 ? '#3D7BEA' : '#34A853'}"/></svg>`)).png().toBuffer();
        comps.push({ input: icon, left: ix, top: top + 50 });
      }
      labels.push(`<text x="${wx + 40 + 150}" y="${top + 136}" font-family="DejaVu Sans" font-size="13" text-anchor="middle" fill="${j ? '#fff' : '#111'}">Estimate Maker</text>`);
      labels.push(`<text x="${wx + 20}" y="${top + 196}" font-family="DejaVu Sans" font-size="14" fill="${j ? '#9AA6BC' : '#6B6B6B'}">60 px, ${j ? 'dark' : 'light'} wallpaper</text>`);
    }
  }
  const defs = `<defs><linearGradient id="w0" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F3D9C9"/><stop offset="1" stop-color="#C9D8F0"/></linearGradient><linearGradient id="w1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22324D"/><stop offset="1" stop-color="#0B0E14"/></linearGradient></defs>`;
  const bg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${defs}<rect width="${W}" height="${H}" fill="#FFFFFF"/>${walls.join('')}${labels.join('')}</svg>`);
  const out = path.join(ROOT, 'docs/design/icon-options.png');
  await sharp(bg).composite(comps).png().toFile(out);
  console.log('docs/design/icon-options.png');
}

async function write() {
  const svg = Buffer.from(art[CHOSEN]());
  await sharp(svg).resize(1024, 1024).flatten({ background: '#ffffff' }).png().toFile(`${ROOT}/assets/icon.png`);
  // Splash: the icon's tile with its corners, centred on the app's background (app.json splash colours).
  await sharp(await masked(CHOSEN, 512)).toFile(`${ROOT}/assets/splash-icon.png`);
  await sharp(await masked(CHOSEN, 512)).toFile(`${ROOT}/assets/splash-icon-dark.png`);
  await sharp(svg).resize(48, 48).png().toFile(`${ROOT}/assets/favicon.png`);
  await sharp(svg).resize(1024, 1024).png().toFile(`${ROOT}/assets/android-icon-foreground.png`);
  fs.mkdirSync(`${ROOT}/docs`, { recursive: true });
  await sharp(await masked(CHOSEN, 512)).toFile(`${ROOT}/docs/icon-512.png`);
  await sharp(svg).resize(180, 180).png().toFile(`${ROOT}/docs/apple-touch-icon.png`);
  console.log('assets/icon.png, splash, favicon, docs/icon-512.png, docs/apple-touch-icon.png');
}

(process.argv[2] === 'options' ? options() : write()).catch((e) => {
  console.error(e);
  process.exit(1);
});
