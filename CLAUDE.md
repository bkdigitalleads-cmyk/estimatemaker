@AGENTS.md

# Estimate Maker (estimatemaker)

App #15 in Brian's iOS app portfolio (seller bkdigitalleads-cmyk). Expo SDK 57, React Native 0.86, TypeScript, expo-sqlite (every document, client, item and setting), pdf-lib with @pdf-lib/fontkit (every PDF), react-native-svg (the on-screen page preview, drawn from the same layout as the PDF), @shopify/react-native-skia (the pen engine for signatures, and the logo re-encode), RevenueCat, expo-notifications (local only, one trial reminder). Engine forked from Signature Maker (signaturemaker main at 5a6391f, Nov 17, 2026), which came from Migraine Log, Image to Text, Pumping and Odo 1.0.6. The signature library, typed script fonts, PDF placement, react-native-pdf, "Open in" document types and Photos saving were dropped. There are no local native modules.

- App Store name: "Estimate Maker & Receipt Maker". Subtitle "Invoice Generator, Quote Maker". Home screen name and in-app name: "Estimate Maker". Category Business, secondary Productivity. Bundle ID com.bwk.estimatemaker. Expo slug and scheme: estimatemaker. Owner bkdeveloper123. GitHub: bkdigitalleads-cmyk/estimatemaker.
- Set up (Nov 17, 2026, values from Cowork): app.json `extra.revenueCatApiKeyIos` is the public RevenueCat SDK key (starts with `appl_`, so purchases are on; the app runs with purchases off whenever it does not), eas.json `ascAppId` 6835862478 (https://apps.apple.com/app/id6835862478). app.json `extra.eas.projectId` 856ac8c1-33de-48e9-a845-64e9cd7354a3 (Expo project bkdeveloper123/estimatemaker, set Nov 18). No placeholders are left.
- Not in the store yet. Version 1.0.0 build 1 is on branch claude/estimate-1.0.0 (PR, not merged).
- What it is: an offline estimate, quote, invoice and receipt maker for contractors, freelancers and small shops. No account, no server, nothing leaves the phone unless the person shares a PDF.
- Guardrail, always: every document prints the person's own business details. Never ship a template, sample or screenshot that imitates a store, brand or bank, and never use a retailer's name in samples. Sample data uses plain people's names and "Your Business".

## How shipping works (read before every push)

- A push to `main` that touches app.json, eas.json, package*.json, App.tsx, index.ts, src/, assets/ or modules/ starts an EAS workflow (.eas/workflows/deploy.yml) once the Expo project is connected. It builds iOS in the cloud and uploads the build to App Store Connect / TestFlight. Every such push costs a paid build credit. (modules/ stays in the filter from the engine; this app has none.)
- Never merge to `main` without Brian. Work on a branch and open a PR.
- Pushes that only change Markdown files (CLAUDE.md, NOTES.md, README.md, store/metadata.md), store/ or docs/ do not build.
- Version numbers are local (`appVersionSource: local`, no auto-increment). Before any push that builds: raise `ios.buildNumber` in app.json by 1, and raise `version` when it will become a new App Store release. A build number that was already used makes the upload fail.
- Before every commit: run `npx tsc --noEmit` and `npm test`, and fix every error.
- Batch the changes for one app into one push. Ask Brian before any push that builds, and say what is in it.
- Submitting for App Review, release dates, prices, the subtitle, keywords, the age rating and screenshots all happen in App Store Connect. Brian and his Cowork session handle that side. Do not try to do it from here.

## Rules

- Brian handles every credential and sign-in. Never type, paste, print or store passwords, tokens or API keys. If git push asks for credentials, stop and tell Brian.
- No spending (paid services, EAS builds beyond what Brian approved) without Brian saying go.
- Never change the RevenueCat entitlement id `pro`, the offering `default`, the product ids (estimate_pro_weekly, estimate_pro_yearly, estimate_pro_lifetime), the packages ($rc_weekly, $rc_annual, $rc_lifetime) or the logic in src/purchases.ts (a copy of the engine's) without Brian asking. Paying users must never lose Pro. Prices on screen always come from RevenueCat.
- Free forever (src/gates.ts holds the rules, with checks): any number of drafts, clients and saved items, editing, converting, duplicating, signing and the on-screen preview. The first two documents exported as PDF (share, Mail or Print) are free and clean. After that, exporting a new document needs Pro. A document that went out free can always go out again. Never lock anyone out of documents they already made.
- The database only ever gains migrations (src/db/schema.ts `MIGRATIONS`). Never edit or reorder a shipped migration; add a new one. Old rows must still read.
- Money is stored in minor units (cents) as integers; quantities as numbers. The totals math is in src/money.ts and is unit-tested. Do not do money math anywhere else.
- Do not change the app name, subtitle, keywords or the rating-prompt triggers (first PDF out, a trial started; never while a client is signing) without asking.
- Keep changes small. Fix what the task needs and tidy only the files you already touch. List anything else you notice in NOTES.md under "Noticed, not changed" instead of fixing it. No broad refactors, dependency upgrades or Expo SDK upgrades unless Brian asks.
- Copy voice: plain, short, confident, written like a tradesperson would say it. No "Unlock", "Premium", "Seamless", "Effortless", "Welcome", "Let's", "Professional-grade", exclamation marks or em dashes in any user-facing text (app, notifications, PDFs, store text, website), and none in text Brian sends to other people. Support email bkdigitalleads@gmail.com only.
- Design (docs/design/NOTES.md) uses the theme's tokens, never ad hoc values. Glyphs are drawn in src/ui/Glyph.tsx. No icon pack.
- Fonts: only SIL OFL fonts, each with its licence in assets/fonts.
- plugins/withoutPushEntitlement.js stays last in app.json plugins. After touching plugins, check `npx expo config --type introspect` still shows `ios.entitlements` as `{}` and no camera, microphone, location or photo-library usage strings (the logo comes through the system photo picker, which needs none).
- Nothing leaves the device except a PDF the person sends. Never add analytics, a server, sync or a network call.

## Logging (so Brian's Cowork session can follow along)

- With every commit, add an entry at the top of NOTES.md in the same commit: date, version/build, what changed and why, and how it was checked.

## Testing

- Type check: `npx tsc --noEmit`. Unit checks: `npm test`. Bundle check: `npx expo export --platform ios`. Config: `npx expo config --type introspect`.
- Pure logic has no React or native imports (it imports with a `.ts` extension so Node runs it directly), so `npm test` checks exactly what the app runs.
- Simulator (needs Xcode): Expo Go does not work (Skia and RevenueCat need a development build). Purchases do not complete in the simulator.
- Real-device check: TestFlight build from the EAS workflow, on Brian's iPhone. NOTES.md has the TestFlight checklist.
