// Unit checks for the documents' PDFs: the layout (on the page, inside the
// margins, wrapped, split over pages with the table header repeated), the
// three templates on Letter and A4, real PDFs written by pdf-lib with the
// bundled fonts and read back, signatures as vector paths, characters the
// font cannot draw, and the guardrail that a document prints only the
// person's own business.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PDFDocument, PDFDict, PDFName } = require('pdf-lib');
const ROOT = new URL('..', import.meta.url).pathname;

const LY = await import('../src/pdf/layout.ts');
const FO = await import('../src/pdf/fonts.ts');
const PD = await import('../src/pdf/pdf.ts');
const B64 = await import('../src/pdf/base64.ts');
const SD = await import('../src/sampleDoc.ts');
const SM = await import('../src/sample.ts');
const ST = await import('../src/settings.ts');

const fonts = Object.fromEntries(Object.entries(FO.FONT_FILES).map(([k, f]) => [k, new Uint8Array(readFileSync(`${ROOT}assets/fonts/${f}`))]));
const measure = FO.makeMeasure(fonts);
const OWN = { name: 'Northside Gutter Co', address: '9 Test Road\nTesttown', phone: '555 0199', email: 'office@northside.example', website: '', taxId: 'Reg 12345' };

const lay = (doc, o = {}) => LY.layoutDoc(measure, { doc, business: OWN, logo: null, ownerSignature: null, template: 'ledger', accent: '#1F3A5F', paper: 'letter', locale: 'en-US', ...o });
const texts = (pages) => pages.flatMap((p) => p.ops.filter((o) => o.k === 'text').map((o) => o.text));

test('fonts: four IBM Plex files under the SIL OFL, with the licence; every currency symbol in the picker draws', async () => {
  for (const f of Object.values(FO.FONT_FILES)) assert.ok(existsSync(`${ROOT}assets/fonts/${f}`), f);
  assert.match(readFileSync(`${ROOT}assets/fonts/OFL-IBMPlex.txt`, 'utf8'), /SIL Open Font License/);
  for (const f of readdirSync(`${ROOT}assets/fonts`).filter((x) => x.endsWith('.ttf'))) assert.ok(/^IBMPlex/.test(f), `unlicensed font ${f}`);
  const { CURRENCIES, formatMoney } = await import('../src/format.ts');
  for (const c of CURRENCIES) {
    const s = formatMoney(123456, c.code, 'en-US');
    assert.equal(measure.clean(s, 'regular'), s.replace(/[‎‏]/g, ''), `${c.code}: ${s}`);
  }
});

test('measuring: widths scale with size; a missing glyph becomes "?"; control characters and joiners go', () => {
  const w10 = measure.width('Invoice 0042', 'regular', 10);
  assert.ok(Math.abs(measure.width('Invoice 0042', 'regular', 20) - 2 * w10) < 1e-9);
  assert.ok(measure.width('1111', 'regular', 10) === measure.width('8888', 'regular', 10), 'tabular figures');
  assert.equal(measure.clean('Tile 🙂 work', 'regular'), 'Tile ? work');
  assert.equal(measure.clean('a\u0007b‍c️', 'regular'), 'abc');
});

test('wrapping: never wider than the column, keeps the person\'s line breaks, cuts a word that cannot fit', () => {
  const lines = LY.wrap(measure, 'Patch and skim coat the hallway walls, prime, and two coats of eggshell\nTrim in semi-gloss', 'regular', 9.5, 160);
  assert.ok(lines.length >= 4);
  assert.ok(lines.every((l) => measure.width(l, 'regular', 9.5) <= 160));
  assert.ok(lines.includes('Trim in semi-gloss'));
  const long = LY.wrap(measure, 'x'.repeat(200), 'regular', 9.5, 100);
  assert.ok(long.length > 1 && long.every((l) => measure.width(l, 'regular', 9.5) <= 100));
  assert.deepEqual(LY.wrap(measure, '', 'regular', 9.5, 100), ['']);
});

test('every template on Letter and A4: one page for a short document, everything inside the paper, the business on top', () => {
  for (const template of ['ledger', 'banner', 'plain']) {
    for (const paper of ['letter', 'a4']) {
      for (const type of ['estimate', 'quote', 'invoice', 'receipt']) {
        const pages = lay(SD.sampleDoc(type), { template, paper, logo: { width: 300, height: 120 }, ownerSignature: { strokes: SM.SAMPLE_SIGNATURE, width: 361, height: 232 } });
        assert.equal(pages.length, 1, `${template} ${paper} ${type}`);
        const p = pages[0];
        assert.deepEqual([p.width, p.height], paper === 'letter' ? [612, 792] : [595.28, 841.89]);
        for (const o of p.ops) {
          if (o.k === 'text') {
            assert.ok(o.x >= -0.01 && o.x + measure.width(o.text, o.font, o.size) <= p.width + 0.01, `${template} ${type}: "${o.text}" runs off`);
            assert.ok(o.y > 0 && o.y < p.height);
          }
          if (o.k === 'rect' && !o.rotate) assert.ok(o.x >= 0 && o.x + o.w <= p.width + 0.01 && o.y >= 0 && o.y + o.h <= p.height);
        }
        const t = texts(pages);
        assert.ok(t.includes('Northside Gutter Co'), 'the business name');
        assert.ok(t.some((s) => s.includes('9 Test Road')), 'the address');
        assert.ok(t.includes(type.toUpperCase()), 'the type');
        assert.ok(t.includes(SD.sampleDoc(type).number));
        assert.ok(p.ops.some((o) => o.k === 'image'), 'the logo');
        assert.ok(p.ops.some((o) => o.k === 'path'), 'the owner signature');
      }
    }
  }
});

test('the totals print as the app adds them up; receipts say what was paid; a paid document gets the stamp', async () => {
  const { docTotals } = await import('../src/docs.ts');
  const { formatMoney } = await import('../src/format.ts');
  const inv = SD.sampleDoc('invoice');
  const t = docTotals(inv);
  const tx = texts(lay(inv));
  for (const v of [t.subtotal, t.tax, t.total, t.balance]) assert.ok(tx.includes(formatMoney(v, 'USD', 'en-US')), `${v}`);
  assert.ok(tx.includes('Balance due'));
  const rec = texts(lay(SD.sampleDoc('receipt')));
  assert.ok(rec.includes('Amount paid') && rec.includes('PAID') && rec.includes('Check 2214'));
  assert.ok(!texts(lay(SD.sampleDoc('estimate'))).includes('PAID'));
  const unpaid = texts(lay(SD.sampleDoc('invoice', { paid: 0 })));
  assert.ok(unpaid.includes('Total due') && !unpaid.includes('Balance due'), 'nothing paid: the total is the last line');
  const nodisc = texts(lay(SD.sampleDoc('estimate', { discountValue: 0, taxRate: 0 })));
  assert.ok(!nodisc.some((s) => s.startsWith('Discount') || s.startsWith('Tax')));
});

test('a long document runs onto more pages: the table header repeats, footers count the pages, nothing falls off the bottom', () => {
  const lines = Array.from({ length: 60 }, (_, i) => ({ id: `l${i}`, description: i % 4 === 0 ? 'Remove and replace damaged fascia board along the north side, prime and paint to match' : `Part ${i}`, qty: 1, unit: 'ea', rate: 1000 + i, taxable: true }));
  const pages = lay(SD.sampleDoc('invoice', { lines }));
  assert.ok(pages.length >= 3);
  pages.forEach((p, i) => {
    const t = p.ops.filter((o) => o.k === 'text').map((o) => o.text);
    assert.ok(t.includes(`INV-0118   Page ${i + 1} of ${pages.length}`));
    if (i > 0) assert.ok(t.includes('DESCRIPTION') || t.includes('NOTES') || t.includes('Subtotal'), `page ${i + 1} carries on`);
    for (const o of p.ops) if (o.k === 'text') assert.ok(o.y <= p.height - 30, `text in the bottom margin on page ${i + 1}`);
  });
  const all = texts(pages);
  for (const l of lines) if (l.description.startsWith('Part')) assert.ok(all.includes(l.description), l.description);
});

test('signatures: the client\'s strokes print as vector paths on the Accepted by line, fitted to the box', () => {
  const signed = { strokes: SM.SAMPLE_SIGNATURE, width: 361, height: 232, name: 'Dana Ruiz', at: Date.UTC(2026, 10, 18, 12) };
  const p = lay(SD.sampleDoc('estimate', { clientSigned: signed, ownerSign: false }))[0];
  const paths = p.ops.filter((o) => o.k === 'path');
  assert.equal(paths.length, SM.SAMPLE_SIGNATURE.length);
  assert.ok(paths.every((o) => o.tx > p.width / 2 - 40 && o.s > 0 && o.s < 1));
  const t = texts([p]);
  assert.ok(t.includes('Accepted by') && t.some((s) => s.startsWith('Dana Ruiz, Nov 18, 2026')));
  // An invoice with no signatures has no signature lines.
  assert.ok(!texts(lay(SD.sampleDoc('invoice', { ownerSign: false }))).includes('Client signature'));
});

test('PDF: written by pdf-lib with the fonts embedded, the right page count and size, a logo, and it reads back', async () => {
  const logo = B64.base64ToBytes('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
  const doc = SD.sampleDoc('estimate', { clientSigned: { strokes: SM.SAMPLE_SIGNATURE, width: 361, height: 232, name: 'Dana Ruiz', at: 1 } });
  const pages = lay(doc, { template: 'banner', paper: 'a4', logo: { width: 1, height: 1 }, ownerSignature: { strokes: SM.SAMPLE_SIGNATURE, width: 361, height: 232 } });
  const bytes = await PD.writePdf(pages, fonts, logo, { title: 'Estimate EST-0042', author: OWN.name, subject: 'Estimate for Dana Ruiz' });
  assert.equal(String.fromCharCode(...bytes.slice(0, 5)), '%PDF-');
  assert.ok(bytes.length < 400_000, `${bytes.length} bytes: fonts are subset`);
  const back = await PDFDocument.load(bytes);
  assert.equal(back.getPageCount(), 1);
  const { width, height } = back.getPage(0).getSize();
  assert.ok(Math.abs(width - 595.28) < 0.01 && Math.abs(height - 841.89) < 0.01);
  assert.equal(back.getTitle(), 'Estimate EST-0042');
  assert.equal(back.getAuthor(), OWN.name);
  const objs = back.context.enumerateIndirectObjects().map(([, o]) => o).filter((o) => o instanceof PDFDict);
  assert.equal(objs.filter((o) => o.get(PDFName.of('FontFile2'))).length, 4, 'four fonts embedded');
  assert.ok(objs.some((o) => o.get(PDFName.of('Subtype')) === PDFName.of('Image')) || back.context.enumerateIndirectObjects().some(([, o]) => o.dict?.get?.(PDFName.of('Subtype')) === PDFName.of('Image')), 'the logo');
});

test('base64: decodes to the same bytes Node does', () => {
  for (const s of ['', 'a', 'ab', 'abc', 'hello world', '\u0000ÿ\u0080']) {
    const b64 = Buffer.from(s, 'latin1').toString('base64');
    assert.deepEqual([...B64.base64ToBytes(b64)], [...Buffer.from(b64, 'base64')]);
  }
});

test('guardrail: a document prints only the person\'s own business; the layout and templates name no business, store, brand or bank', () => {
  const t = texts(lay(SD.sampleDoc('invoice', { terms: 'Due in 14 days.' }))).join('\n');
  assert.ok(!t.includes(SD.SAMPLE_BUSINESS.name), 'the sample business never leaks onto a real document');
  const empty = texts(lay(SD.sampleDoc('estimate'), { business: { ...ST.EMPTY_BUSINESS } }));
  assert.ok(empty.includes('Your business name'), 'an empty profile shows a placeholder (the app asks for a name before anything goes out)');
  const src = ['src/pdf/layout.ts', 'src/pdf/pdf.ts', 'src/settings.ts'].map((f) => readFileSync(`${ROOT}${f}`, 'utf8')).join('\n');
  for (const w of [/walmart/i, /home depot/i, /lowe'?s/i, /amazon/i, /costco/i, /target corp/i, /chase/i, /wells fargo/i, /bank of/i, /paypal/i, /stripe/i, /square(?! feet)/i, /quickbooks/i, /intuit/i, /visa\b/i, /mastercard/i]) assert.equal(src.match(w), null, `${w}`);
  const preview = readFileSync(`${ROOT}src/screens/Preview.tsx`, 'utf8');
  assert.match(preview, /if \(!data\.business\.name\.trim\(\)\)/, 'no PDF goes out without the business name');
});

test('free exports: the gate is checked before a PDF is made, and only a PDF that went out uses one', () => {
  const preview = readFileSync(`${ROOT}src/screens/Preview.tsx`, 'utf8');
  assert.match(preview, /exportDecision\(app\.isPro, app\.freeExports, doc\.id\)/);
  assert.match(preview, /if \(decision\.usesFree && out\) app\.noteFreeExport\(doc\.id\)/);
  assert.match(preview, /maybeRequestReview\('firstExport'\)/);
});
