# Estimate Maker

Estimates, quotes, invoices and receipts for contractors, freelancers and small shops, made on the iPhone. No account, no server: everything lives in SQLite on the phone, and PDFs are made on the phone with pdf-lib.

- App: Expo SDK 57, React Native, TypeScript. `npm install`, then `npx tsc --noEmit` and `npm test`.
- Website: `docs/` (GitHub Pages): landing page, privacy policy, support.
- Store listing: `store/metadata.md`. Screenshots: `cd store && npm install && node screenshots.js`. Icon: `node icon.js` (`node icon.js options` for the concepts). PDF samples: `node store/pdf-samples.mjs` from the repo root.
- Design: `docs/design/NOTES.md`, with before and after renders, the PDF samples and the icon options.
- Rules for working in this repo: `CLAUDE.md`. Change log and TestFlight checklist: `NOTES.md`.
