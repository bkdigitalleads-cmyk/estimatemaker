# Estimate Maker change log

Newest first. One entry per commit: date, version/build, what changed and why, and how it was checked.

- 2026-11-17: 1.0.0 build 1, step 2 of 7: data layer.
  - SQLite through expo-sqlite (src/db/native.ts, one file, estimatemaker.db, WAL), behind a small Db interface (src/db/schema.ts) so the same SQL runs on Node's built-in node:sqlite in the tests. Migrations are a list that only grows; PRAGMA user_version counts them; each runs in its own transaction, and a database from a newer app is refused rather than damaged.
  - Tables: kv (settings, flags, counters for free exports), counters (prefix and next number per type), clients, items, docs (one model for all four types, with the client's details copied in so a sent document keeps what it printed, and the total and balance kept for the list), lines (in order).
  - Money is integers in minor units (fixed scale of 100); src/money.ts is the only place that adds it up: each line rounded, discount as a percent or an amount (never more than the subtotal), tax only on taxable lines after their share of the discount, deposit or paid, balance (below zero is a credit). Currencies with no decimals round to whole units.
  - src/numbering.ts: EST-, QUO-, INV-, REC- with their own sequences, four digits; a number typed ahead of the sequence moves the counter past it; deleted numbers are not reused.
  - src/docs.ts: new drafts from the defaults, one-tap convert (estimate or quote to invoice marks the source accepted; invoice to receipt is paid in full and marks the invoice paid), duplicate, search and filters, overdue, and the home numbers (billed this month and unpaid, per currency; drafts count in neither).
  - src/format.ts: money, numbers and dates in the phone's locale with Intl; typed amounts read with either decimal mark. src/settings.ts: business profile, logo, owner signature and defaults, with fallbacks for damaged rows; Letter or A4 and Tax, VAT or GST from the region.
  - The settings key/value store moved from settings.json into the kv table.
  - Checked: `npx tsc --noEmit` clean, `npm test` 38 passing (24 new: totals, tax, discount, rounding, typed amounts, numbering, migrations including a failed one rolling back, every read and write, convert, duplicate, statuses, clients and items, filters, home numbers, settings, locale formats, dates).

- 2026-11-17: 1.0.0 build 1, step 1 of 7: scaffold and engine port (branch claude/estimate-1.0.0).
  - Started from Signature Maker main at 5a6391f: same Expo SDK 57.0.12, React Native 0.86.3, React 19.2.3, TypeScript 6.0, EAS workflow files (.eas/workflows/deploy.yml and submit.yml, unchanged), eas.json (local version source, no auto-increment), plugins/withoutPushEntitlement.js (last in plugins), index.ts startup guard, App.tsx render guard and font-load wait.
  - Kept as engine copies: src/purchases.ts (unchanged), src/trial.ts, src/reminder.ts (new id and wording), src/testing.ts, src/offer.ts (weekly now first and preselected on both paywalls, as briefed), src/reviews.ts and src/rules.ts (two triggers: first PDF out and a trial started; the guard is "never while a client is signing"), src/stroke.ts and src/sample.ts (the pen engine, for the owner's and the client's signatures), src/ui (Kit, Glyph, motion, TabBar, Pad, InkView), the paywall and the onboarding trial and reminder screens.
  - Dropped: the signature library, typed script fonts and their licences, PDF placement and flattening, react-native-pdf and react-native-blob-util, expo-document-picker, expo-clipboard, expo-media-library, "Open in" document types, the Library, Create, Export, Documents and Sign screens.
  - Added: expo-sqlite 57.0.4, expo-print 57.0.2, expo-localization 57.0.2, expo-asset 57.0.20 (versions from expo's bundledNativeModules.json; `npx expo install` could not reach api.expo.dev from here), @pdf-lib/fontkit 1.1.1.
  - Identity: name Estimate Maker, slug and scheme estimatemaker, bundle com.bwk.estimatemaker, 1.0.0 build 1, iPhone only, category Business. Three placeholders for Cowork: TODO_COWORK_EXPO_PROJECT_ID, TODO_COWORK_REVENUECAT_PUBLIC_IOS_KEY, TODO_COWORK_ASC_APP_ID.
  - src/gates.ts rewritten: the first two documents out are free; a third needs Pro; a document that went out free can always go out again.
  - Checked: `npx tsc --noEmit` clean, `npm test` 14 passing, `npx expo export --platform ios` bundles, `npx expo config --type introspect` shows `entitlements: {}` and no usage strings.

## Noticed, not changed

- Nothing yet.
