// Sample PDFs from the app's own layout and writer (src/pdf), for
// docs/design/pdf: every template on Letter and A4, each document type, a
// long multi-page invoice, and a page with no logo, an empty business and
// an unusual currency. PNGs of page 1 come from pdftoppm.
// Run from the repo root: node store/pdf-samples.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const ROOT = new URL('..', import.meta.url).pathname;
const require = createRequire(`${ROOT}store/`);
const sharp = require('sharp');
const { layoutDoc } = await import(`${ROOT}src/pdf/layout.ts`);
const { makeMeasure, FONT_FILES } = await import(`${ROOT}src/pdf/fonts.ts`);
const { writePdf } = await import(`${ROOT}src/pdf/pdf.ts`);
const { SAMPLE_BUSINESS, sampleDoc } = await import(`${ROOT}src/sampleDoc.ts`);
const { SAMPLE_SIGNATURE, SAMPLE_PAD } = await import(`${ROOT}src/sample.ts`);
const { ACCENTS } = await import(`${ROOT}src/settings.ts`);

const fonts = Object.fromEntries(Object.entries(FONT_FILES).map(([k, f]) => [k, new Uint8Array(readFileSync(`${ROOT}assets/fonts/${f}`))]));
const measure = makeMeasure(fonts);

// A plain monogram logo, drawn here, standing in for the person's own.
const logoPng = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360"><rect width="360" height="360" rx="40" fill="#2F2A26"/><text x="180" y="236" font-family="DejaVu Serif" font-size="170" font-weight="bold" fill="#F3EEE4" text-anchor="middle">OC</text></svg>`)).png().toBuffer();
const logo = { width: 360, height: 360 };
const owner = { strokes: SAMPLE_SIGNATURE, width: SAMPLE_PAD.width, height: SAMPLE_PAD.height };

const OUT = `${ROOT}docs/design/pdf`;
mkdirSync(OUT, { recursive: true });

async function make(name, doc, opts) {
  const pages = layoutDoc(measure, { doc, business: opts.business ?? SAMPLE_BUSINESS, logo: opts.noLogo ? null : logo, ownerSignature: owner, template: opts.template, accent: opts.accent, paper: opts.paper, locale: opts.locale ?? 'en-US' });
  const bytes = await writePdf(pages, fonts, opts.noLogo ? null : new Uint8Array(logoPng), { title: `${doc.number}`, author: 'sample', subject: doc.type });
  writeFileSync(`${OUT}/${name}.pdf`, bytes);
  execFileSync('pdftoppm', ['-png', '-r', '110', '-f', '1', '-l', '1', '-singlefile', `${OUT}/${name}.pdf`, `${OUT}/${name}`]);
  console.log(`docs/design/pdf/${name}.pdf (${pages.length} page${pages.length > 1 ? 's' : ''})`);
}

// The client signs too: the sample's first strokes stand in for a second hand.
const signed = { strokes: SAMPLE_SIGNATURE.slice(0, 2), width: SAMPLE_PAD.width, height: SAMPLE_PAD.height, name: 'Dana Ruiz', at: Date.UTC(2026, 10, 18, 18) };
await make('ledger-letter-estimate', sampleDoc('estimate', { clientSigned: signed, status: 'accepted' }), { template: 'ledger', accent: ACCENTS[0].hex, paper: 'letter' });
await make('banner-letter-invoice', sampleDoc('invoice'), { template: 'banner', accent: ACCENTS[1].hex, paper: 'letter' });
await make('plain-letter-receipt', sampleDoc('receipt'), { template: 'plain', accent: ACCENTS[2].hex, paper: 'letter' });
await make('ledger-a4-quote', sampleDoc('quote', { currency: 'GBP', taxLabel: 'VAT', taxRate: 20 }), { template: 'ledger', accent: ACCENTS[3].hex, paper: 'a4', locale: 'en-GB' });
await make('banner-a4-estimate', sampleDoc('estimate', { currency: 'EUR', taxLabel: 'MwSt', taxRate: 19 }), { template: 'banner', accent: ACCENTS[4].hex, paper: 'a4', locale: 'de-DE' });
await make('plain-a4-invoice', sampleDoc('invoice', { currency: 'INR', taxLabel: 'GST', taxRate: 18 }), { template: 'plain', accent: ACCENTS[5].hex, paper: 'a4', locale: 'en-IN' });
const many = Array.from({ length: 34 }, (_, i) => ({ id: `m${i}`, description: i % 5 === 0 ? `Room ${i / 5 + 1}: patch and skim coat walls, prime, two coats of eggshell on walls and semi-gloss on trim` : `Item ${i + 1}`, qty: (i % 4) + 1, unit: 'ea', rate: 1250 * ((i % 7) + 1), taxable: i % 3 !== 0 }));
await make('ledger-letter-invoice-long', sampleDoc('invoice', { lines: many, status: 'sent', paid: 0, ownerSign: true }), { template: 'ledger', accent: ACCENTS[0].hex, paper: 'letter' });
await make('plain-letter-estimate-empty-business', sampleDoc('estimate', { client: { name: '', email: '', phone: '', address: '' }, notes: '', terms: '', lines: [{ id: 'z', description: 'Service call', qty: 1, unit: '', rate: 9500, taxable: true }], taxRate: 0, discountValue: 0 }), { template: 'plain', accent: ACCENTS[1].hex, paper: 'letter', noLogo: true, business: { name: '', address: '', phone: '', email: '', website: '', taxId: '' } });
