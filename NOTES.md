# Estimate Maker change log

Newest first. One entry per commit: date, version/build, what changed and why, and how it was checked.

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
