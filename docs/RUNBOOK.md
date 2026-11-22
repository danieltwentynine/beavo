# Runbook

## Checks (run before every commit; CI runs the same)
```bash
npm ci                                   # clean install
npx tsc --noEmit                         # typecheck (strict)
npx expo lint                            # ESLint incl. camera guardrail rules
node scripts/check-camera-guardrail.mjs  # no mic permission, no capture/frame-processor packages
npm test                                 # node --test src/data/*.test.ts (Node 24: .nvmrc, package.json engines)
npx expo install --check                 # Expo packages match the installed SDK
npm run test:emulator                    # Firestore rules + repository tests (needs Java)
TZ=America/New_York npm test             # exercises the DST boundary cases
npm run build:legal                      # legal/*.md → public/legal/*.html; fails on version mismatch
```
Tests use `node:test` + `node:assert` (no framework). New pure repository logic goes in `src/data/` with a sibling `*.test.ts`.

## Legal pages (Firebase Hosting)
`npx firebase login` once, then `npx firebase deploy --only hosting` (predeploy builds the pages). URLs: `https://beavo-dental.web.app/legal/{terms,privacy-policy}.{pt-BR,en}.html` — these go in App Store Connect. When a document changes in substance, bump `LEGAL_VERSIONS` in `lib/legal.ts`, the version line in each file, and `currentTermsVersion` / `currentPrivacyVersion` in `firestore.rules` (a rules test fails if they differ); parents are asked to accept again. Deploy those rules together with the app release that bumps the versions: the rules accept only a consent with today's versions.

## Expo version
`package.json` is the authority (currently SDK 57). Before using any Expo API, read the docs for the **installed** SDK version (see `AGENTS.md`). Upgrade by SDK, not by package: `npx expo install expo@latest --fix`, then the checks above and `npx expo export --platform ios --output-dir <tmp>`. Stay on the SDK-pinned versions of react, react-native, reanimated, screens, etc.; don't bump them individually.

## Local run
```bash
npx expo start      # press i for the iOS simulator
```
Native modules (Google Sign-In, dev client) need a development build, not Expo Go.

## Release
See `.claude/skills/release-testflight/SKILL.md`.

## Common failures
- `EALLOWSCRIPTS` from `npx expo install` — see the comment in `.npmrc`; add script allowances to `package.json` `allowScripts`.
- Firebase Auth typing errors — `types/firebase-auth.d.ts` augments the module; don't use `@ts-ignore`.
- Emulator tests interfering with each other — test files share one emulator; the script runs them with `--test-concurrency=1`. Keep it.
- `@firebase/rules-unit-testing@6` needs firebase 13; stay on 5.x while the app is on firebase 12.

_Add a line here whenever a failure costs more than 15 minutes._
