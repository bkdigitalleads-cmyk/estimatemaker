// Unit checks for what goes to the App Store and the website: the name and
// subtitle lengths, keywords (at most 100 characters, no word from the name
// or subtitle, no repeats), the privacy page saying Purchases, not linked to
// you, and nothing more, the support address, and six screenshots at each
// required size.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const meta = readFileSync(`${ROOT}store/metadata.md`, 'utf8');
const section = (h) => meta.split(/\n## /).find((s) => s.startsWith(h)).split('\n').slice(1).join('\n').trim();

test('name and subtitle as set in App Store Connect, 30 characters each at most', () => {
  const name = section('Name').split('\n')[0];
  const sub = section('Subtitle').split('\n')[0];
  assert.equal(name, 'Estimate Maker & Receipt Maker');
  assert.equal(sub, 'Invoice Generator, Quote Maker');
  assert.ok(name.length <= 30 && sub.length <= 30);
});

test('keywords: at most 100 characters, no word from the name or the subtitle, no repeats, no spaces', () => {
  const kw = section('Keywords').split('\n')[0];
  assert.ok(kw.length <= 100, `${kw.length}`);
  assert.ok(!/\s/.test(kw));
  const words = kw.split(',');
  assert.equal(new Set(words).size, words.length);
  const banned = new Set('Estimate Maker & Receipt Maker Invoice Generator, Quote Maker'.toLowerCase().split(/[^a-z]+/).filter(Boolean));
  for (const w of words) assert.ok(!banned.has(w), w);
  assert.match(meta, new RegExp(`\\(${kw.length}/100\\)`), 'the heading counts them');
});

test('promotional text fits; products and RevenueCat ids are exactly as set up', () => {
  const promo = section('Promotional text');
  assert.ok(promo.length <= 170, `${promo.length}`);
  for (const id of ['estimate_pro_weekly', 'estimate_pro_yearly', 'estimate_pro_lifetime', '$rc_weekly', '$rc_annual', '$rc_lifetime', 'entitlement `pro`', 'offering `default`']) assert.ok(meta.includes(id), id);
  assert.match(meta, /\$6\.99\/week, 3-day free trial/);
  assert.match(meta, /\$39\.99\/year/);
  assert.match(meta, /\$79\.99 one time/);
});

test('privacy page: Purchases, not linked to identity, through RevenueCat, and nothing more is collected', () => {
  const p = readFileSync(`${ROOT}docs/privacy.html`, 'utf8');
  assert.match(p, /Purchases/);
  assert.match(p, /RevenueCat/);
  assert.match(p, /not linked to your identity/);
  assert.match(p, /That is all\./);
  for (const w of [/analytics provider/i, /we collect your (name|email|location)/i, /advertis/i, /cookies/i]) assert.equal(p.match(w), null, `${w}`);
  assert.match(p, /mailto:bkdigitalleads@gmail\.com/);
});

test('website: landing, privacy and support pages with the support address, the App Store link and no placeholders', () => {
  for (const f of ['index.html', 'privacy.html', 'support.html', 'style.css', 'icon-512.png', 'apple-touch-icon.png', 'og-image.png', 'robots.txt', 'sitemap.xml', 'fonts/OFL-IBMPlex.txt']) assert.ok(existsSync(`${ROOT}docs/${f}`), f);
  const support = readFileSync(`${ROOT}docs/support.html`, 'utf8');
  assert.match(support, /mailto:bkdigitalleads@gmail\.com/);
  assert.match(support, /we reply within two business days/);
  const index = readFileSync(`${ROOT}docs/index.html`, 'utf8');
  assert.match(index, /https:\/\/apps\.apple\.com\/app\/id6835862478/);
  for (const m of index.matchAll(/src="([^"]+\.png)"/g)) assert.ok(existsSync(`${ROOT}docs/${m[1]}`), m[1]);
  for (const f of ['index.html', 'privacy.html', 'support.html']) assert.ok(!/TODO_COWORK/.test(readFileSync(`${ROOT}docs/${f}`, 'utf8')), f);
});

function pngSize(file) {
  const b = readFileSync(file);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

test('screenshots: six captioned shots at 1206x2622 and six at 1320x2868', () => {
  for (const [dir, w, h] of [['6.3', 1206, 2622], ['6.9', 1320, 2868]]) {
    const files = readdirSync(`${ROOT}store/screenshots/${dir}`).filter((f) => f.endsWith('.png')).sort();
    assert.equal(files.length, 6, dir);
    for (const f of files) assert.deepEqual(pngSize(`${ROOT}store/screenshots/${dir}/${f}`), [w, h], `${dir}/${f}`);
  }
});
