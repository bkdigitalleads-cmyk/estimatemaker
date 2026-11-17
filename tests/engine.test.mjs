// Unit checks for the engine carried over from Signature Maker: the pen
// engine (smoothing, widths, the outline), trial and plan rules, the rating
// guard, free versus Pro, and the app config and copy rules. Run with
// `npm test` (Node 22+ strips the TypeScript types itself).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

const S = await import('../src/stroke.ts');
const G = await import('../src/gates.ts');
const O = await import('../src/offer.ts');
const U = await import('../src/rules.ts');
const SM = await import('../src/sample.ts');

const ROOT = new URL('..', import.meta.url).pathname;

const stroke = (pen, xy, ms = 10, force = 0, size = 1) => ({ pen, size, pts: xy.map(([x, y], i) => [x, y, i * ms, force]) });
const line = (x0, y0, x1, y1, n = 20) => Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
const wave = (n = 60) => Array.from({ length: n + 1 }, (_, i) => [10 + i * 5, 100 + 30 * Math.sin(i / 5)]);
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

// ---------- the pen engine (signatures) ----------

test('smoothing: passes through every touch point, resamples evenly, keeps time in order', () => {
  const keys = [[0, 0, 0, 0.2], [40, 30, 40, 0.4], [80, 0, 80, 0.6], [120, 30, 120, 0.8]];
  const out = S.smooth(keys, 2);
  for (const k of keys) assert.ok(out.some((p) => Math.hypot(p[0] - k[0], p[1] - k[1]) < 1e-6), `missing ${k}`);
  for (let i = 1; i < out.length; i++) {
    assert.ok(Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]) <= 2.6);
    assert.ok(out[i][2] >= out[i - 1][2], 'time goes forward');
  }
  assert.equal(S.smooth([[3, 4, 0, 0]]).length, 1);
});

test('pens: Ink is thicker slow than fast, follows Pencil force, and tapers at the ends', () => {
  const pts = line(0, 0, 300, 0, 60);
  const slow = S.layout(stroke('ink', pts, 40));
  const fast = S.layout(stroke('ink', pts, 2));
  const mid = (s) => mean(s.r.slice(40, -40));
  assert.ok(mid(slow) > mid(fast) * 1.6);
  const light = S.layout(stroke('ink', pts, 10, 0.1));
  const hard = S.layout(stroke('ink', pts, 10, 0.9));
  assert.ok(mid(hard) > mid(light) * 1.8);
  assert.ok(slow.r[0] < mid(slow) * 0.8 && slow.r[slow.r.length - 1] < mid(slow) * 0.8, 'tapered ends');
});

test('outline: every piece is wound the same way (nonzero fill unions them, in Skia and in the PDF); a tap is a dot', () => {
  const d = S.strokePath(stroke('ink', wave()));
  assert.ok(d.startsWith('M') && !/NaN|Infinity/.test(d));
  const quads = [...d.matchAll(/M([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)Z/g)];
  assert.ok(quads.length > 50);
  for (const q of quads) {
    const n = q.slice(1).map(Number);
    assert.ok(S.signedArea2([n[0], n[2], n[4], n[6]], [n[1], n[3], n[5], n[7]]) >= -1e-6);
  }
  assert.match(S.strokePath(stroke('ink', [[10, 10]])), /^M[\d.]+ 10A/);
});

test('sample signature: real ink strokes on its pad, timed like a hand', () => {
  const sig = SM.SAMPLE_SIGNATURE;
  assert.ok(sig.length >= 3 && sig.every((s) => s.pen === 'ink' && s.pts.length > 0));
  const b = S.strokesBounds(sig);
  assert.ok(b.x > 0 && b.x + b.width < SM.SAMPLE_PAD.width && b.y > 0 && b.y + b.height < SM.SAMPLE_PAD.height);
  const ms = S.playLength(sig);
  assert.ok(ms > 1200 && ms < 3000, `${ms} ms`);
});

// ---------- free versus Pro ----------

test('gates: the first two documents go out free; a third needs Pro; one that went out free can always go out again', () => {
  assert.equal(G.FREE_EXPORTS, 2);
  assert.deepEqual(G.exportDecision(false, [], 'a'), { allowed: true, usesFree: true });
  assert.deepEqual(G.exportDecision(false, ['a'], 'b'), { allowed: true, usesFree: true });
  assert.deepEqual(G.exportDecision(false, ['a', 'b'], 'c'), { allowed: false, usesFree: false });
  assert.deepEqual(G.exportDecision(false, ['a', 'b'], 'a'), { allowed: true, usesFree: false }, 'never locked out of one already sent');
  assert.deepEqual(G.exportDecision(true, ['a', 'b'], 'c'), { allowed: true, usesFree: false });
  assert.equal(G.freeExportsLeft(false, ['a']), 1);
  assert.equal(G.freeExportsLeft(false, ['a', 'b', 'c']), 0);
  assert.equal(G.freeExportsLeft(true, []), null);
  const once = G.recordFreeExport(['a'], 'a');
  assert.deepEqual(once, ['a'], 'sharing the same one twice counts once');
  assert.deepEqual(G.recordFreeExport(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(G.parseFreeExports('["a","a",3,"b"]'), ['a', 'b']);
  assert.deepEqual(G.parseFreeExports('{bad'), []);
  assert.deepEqual(G.parseFreeExports(null), []);
  assert.equal(G.canEdit(false), true);
});

// ---------- trial, plans and ratings ----------

test('trial: "3 days free" only for a free intro offer this Apple ID can still get', () => {
  const intro = { price: 0, periodNumberOfUnits: 3, periodUnit: 'DAY' };
  assert.equal(O.trialLength(intro), '3 days');
  assert.equal(O.trialLength({ ...intro, price: 0.99 }), null);
  assert.equal(O.trialLabelFrom(intro, true), '3 days free');
  assert.equal(O.trialLabelFrom(intro, false), null);
});

test('trial reminder: a day before the trial ends; sandbox-short or unknown ends fall back to 2 days out', () => {
  const H = 3_600_000;
  const now = Date.UTC(2026, 10, 17, 12);
  assert.equal(O.trialReminderAt(now + 72 * H, now), now + 48 * H);
  assert.equal(O.trialReminderAt(now + 5 * 60_000, now), now + 48 * H);
  assert.equal(O.trialReminderAt(null, now), now + 48 * H);
});

test('plans: weekly first and preselected on both paywalls, then yearly, then lifetime; disclosure has every price', () => {
  for (const onb of [true, false]) {
    assert.deepEqual(O.planOrder(onb), ['WEEKLY', 'ANNUAL', 'LIFETIME']);
    assert.equal(O.preselect(['LIFETIME', 'ANNUAL', 'WEEKLY'], onb), 'WEEKLY');
  }
  assert.equal(O.preselect(['ANNUAL', 'LIFETIME'], false), 'ANNUAL');
  assert.equal(O.planTypeOf('MONTHLY'), null);
  const d = O.disclosureText({ weekly: '$6.99', yearly: '$39.99', lifetime: '$79.99', trial: '3 days free' });
  assert.match(d, /Weekly \$6\.99\/week .*3 days free/);
  assert.match(d, /Yearly \$39\.99\/year/);
  assert.match(d, /Lifetime \$79\.99 is a one-time purchase/);
});

test('rating asks: never while a client is signing, once per launch, each trigger once, only when StoreKit can', () => {
  const ok = { signing: false, askedThisLaunch: false, triggerUsed: false, storeCanAsk: true };
  assert.equal(U.shouldAsk(ok), true);
  assert.equal(U.shouldAsk({ ...ok, signing: true }), false);
  assert.equal(U.shouldAsk({ ...ok, askedThisLaunch: true }), false);
  assert.equal(U.shouldAsk({ ...ok, triggerUsed: true }), false);
  assert.equal(U.shouldAsk({ ...ok, storeCanAsk: false }), false);
  assert.equal(U.purchaseReview({ onboarding: true, isPro: true, inTrial: true }), 'trialStarted');
  assert.equal(U.purchaseReview({ onboarding: true, isPro: true, inTrial: false }), null, 'yearly or lifetime: no ask');
  assert.equal(U.purchaseReview({ onboarding: false, isPro: true, inTrial: true }), null);
  assert.equal(U.afterOnboardingPaywall(false), 'claim');
  assert.equal(U.afterOnboardingPaywall(true), 'app');
  assert.match(U.dayKey(Date.now()), /^\d{4}-\d{2}-\d{2}$/);
});

test('rating asks: wired where they belong (trial start in the paywall)', () => {
  const pay = readFileSync(`${ROOT}src/screens/Paywall.tsx`, 'utf8');
  assert.match(pay, /purchaseReview\(\{ onboarding, isPro: true, inTrial: await inFreeTrial\(\) \}\)/);
  const rev = readFileSync(`${ROOT}src/reviews.ts`, 'utf8');
  assert.match(rev, /launchState !== 'idle' \|\| signing\(\)/, 'one per launch, never while signing');
});

// ---------- config and copy ----------

test('purchases.ts is the engine copy: entitlement pro, key must start with appl_', () => {
  const p = readFileSync(`${ROOT}src/purchases.ts`, 'utf8');
  assert.match(p, /export const ENTITLEMENT_ID = 'pro';/);
  assert.match(p, /!apiKey\.startsWith\('appl_'\)/);
  assert.match(p, /offerings\.current/);
});

test('app.json: identity, the three Cowork placeholders, iPhone only, no permissions, push entitlement plugin last', () => {
  const app = JSON.parse(readFileSync(`${ROOT}app.json`, 'utf8')).expo;
  assert.equal(app.name, 'Estimate Maker');
  assert.equal(app.slug, 'estimatemaker');
  assert.equal(app.ios.bundleIdentifier, 'com.bwk.estimatemaker');
  assert.equal(app.version, '1.0.0');
  assert.equal(app.ios.buildNumber, '1');
  assert.equal(app.ios.supportsTablet, false);
  assert.equal(JSON.parse(readFileSync(`${ROOT}package.json`, 'utf8')).version, app.version);
  assert.equal(app.owner, 'bkdeveloper123');
  assert.equal(app.plugins[app.plugins.length - 1], './plugins/withoutPushEntitlement');
  const picker = app.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-image-picker')[1];
  assert.deepEqual([picker.photosPermission, picker.cameraPermission, picker.microphonePermission], [false, false, false]);
  assert.ok(!JSON.stringify(app).match(/UsageDescription|Camera|Microphone|Location/));
  const eas = JSON.parse(readFileSync(`${ROOT}eas.json`, 'utf8'));
  assert.equal(eas.cli.appVersionSource, 'local');
  assert.equal(app.extra.eas.projectId, 'TODO_COWORK_EXPO_PROJECT_ID');
  assert.equal(app.extra.revenueCatApiKeyIos, 'TODO_COWORK_REVENUECAT_PUBLIC_IOS_KEY');
  assert.equal(eas.submit.production.ios.ascAppId, 'TODO_COWORK_ASC_APP_ID');
});

function walk(dir, ext) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = `${dir}/${f}`;
    if (f === 'node_modules') return [];
    return statSync(p).isDirectory() ? walk(p, ext) : ext.some((e) => p.endsWith(e)) ? [p] : [];
  });
}

test('placeholders: exactly three, each only where it belongs', () => {
  const files = [`${ROOT}app.json`, `${ROOT}eas.json`, ...walk(`${ROOT}src`, ['.ts', '.tsx']), `${ROOT}App.tsx`];
  const found = new Set();
  for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/TODO_COWORK_[A-Z_]+/g)) found.add(m[0]);
  assert.deepEqual([...found].sort(), ['TODO_COWORK_ASC_APP_ID', 'TODO_COWORK_EXPO_PROJECT_ID', 'TODO_COWORK_REVENUECAT_PUBLIC_IOS_KEY']);
});

test('copy: no em dashes, exclamation marks, banned words or brand names in the app, the website or the store text', () => {
  const files = [...walk(`${ROOT}src`, ['.ts', '.tsx']), `${ROOT}App.tsx`, ...walk(`${ROOT}docs`, ['.html']), ...(existsSync(`${ROOT}store/metadata.md`) ? [`${ROOT}store/metadata.md`] : [])];
  for (const f of files) {
    let s = readFileSync(f, 'utf8');
    if (f.endsWith('metadata.md')) s = s.split('\n').slice(3).join('\n'); // the line that names the rule
    if (/\.(ts|tsx)$/.test(f)) s = (s.match(/'[^'\n]*'|"[^"\n]*"|`[^`]*`|>[^<>{}]+</g) ?? []).filter((t) => !/^'\.\.?\//.test(t) && !/^'(react|expo|@)/.test(t)).join('\n');
    assert.ok(!s.includes('—'), `em dash in ${f}`);
    for (const w of [/\bunlock/i, /\bpremium\b/i, /\bseamless/i, /\beffortless/i, /\belevate/i, /\bpowerful\b/i, /in seconds/i, /\bwelcome\b/i, /\blet's\b/i, /professional-grade/i]) {
      assert.equal(s.match(w), null, `${w} in ${f}`);
    }
  }
  for (const f of [...walk(`${ROOT}src`, ['.ts', '.tsx']), `${ROOT}App.tsx`, ...walk(`${ROOT}docs`, ['.html', '.md']), ...walk(`${ROOT}store`, ['.md', '.js']), `${ROOT}README.md`, ...[`${ROOT}NOTES.md`, `${ROOT}CLAUDE.md`].filter(existsSync)])
    assert.ok(!/brianwkershner/i.test(readFileSync(f, 'utf8')), `personal address in ${f}`);
  assert.match(readFileSync(`${ROOT}src/links.ts`, 'utf8'), /SUPPORT_EMAIL = 'bkdigitalleads@gmail\.com'/);
  // No other real address anywhere in the app or the site (samples use the reserved .example names).
  for (const f of [...walk(`${ROOT}src`, ['.ts', '.tsx']), ...walk(`${ROOT}docs`, ['.html'])])
    for (const m of readFileSync(f, 'utf8').matchAll(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g)) if (!/(\.example|@example\.com)$/.test(m[0])) assert.equal(m[0], 'bkdigitalleads@gmail.com', `${m[0]} in ${f}`);
  for (const f of [...walk(`${ROOT}src`, ['.tsx']), `${ROOT}App.tsx`]) {
    const strings = readFileSync(f, 'utf8').match(/'[^'\n]*'|"[^"\n]*"|`[^`\n]*`|>[^<>{}\n]+</g) ?? [];
    for (const t of strings) assert.ok(!/[A-Za-z0-9.]!(\s|$|['"`<])/.test(t), `exclamation in ${f}: ${t}`);
  }
});
