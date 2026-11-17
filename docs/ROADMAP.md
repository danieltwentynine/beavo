# Roadmap

Source of truth for progress. Keep `CLAUDE.md` pointing here rather than ticking items there.

Last revised 2026-11-17. Open work comes first; finished work is under [Done](#done).

## Now: verify the foundation on a device

In dependency order.

- [x] Deploy `firestore.rules` (accepts `locale: 'es'`) — deployed 2026-11-13
- [x] Wipe legacy top-level `/children` and `/sessions` test data — deleted 2026-11-13 (4 children, 9 sessions)
- [x] Rebuild the dev client (native modules were added in foundation steps 1–3) — rebuilt for the simulator on 2026-11-13
- [ ] Simulator/device pass:
  - [x] without an account (2026-11-13, iPhone 17 simulator, English): tooth chart, tooth sheet add/delete, session (stopped early and full), results, Progress, Brushing History, Settings, Edit routine, grown-ups check
  - [x] create account from device-only mode → consent → move data to the account (2026-11-13, pt-BR; data checked in Firestore)
  - [ ] signed in: a session saved to the account, sign out, sign in again, delete account; erase data on this phone
  - [ ] kid mode on/off (the automation tool could not flip the switch; needs a hand)
  - [x] add, edit and delete a child; Categories; backup export (2026-11-13)
  - [x] pt-BR launch: Overview, Brushing, Progress (2026-11-13)
  - [ ] onboarding intro (needs a fresh install); backup import
  - [ ] Spanish device; a real phone with the camera mirror
  - [ ] Parental gate PIN: choose a PIN (Face ID / passcode), the gate on each gated action, "I forgot the PIN", the multiplication fallback on a phone with no passcode, the wait after 5 wrong tries
  - [ ] VoiceOver: the edit pencil in the child picker is nested inside the row button and can't be reached; avatar colour swatches are announced as hex codes
- [x] Firestore rules reviewed against the privacy checklist (2026-11-13): owner-only, typed writes, default deny; Storage is unused and has no bucket rules to review
- [x] Test and CI baseline: `.github/workflows/ci.yml` runs every check in RUNBOOK and is green on `step1-foundation`

## Next: TestFlight release

- [ ] Legal review of `legal/`; decide whether the Privacy Policy should mention the parental-gate PIN (kept in this phone's Keychain) and the Face ID check (the app only learns yes or no) — neither is mentioned today; fill the two placeholders in the Terms (paid plan, liability); confirm Firestore region; `firebase deploy --only hosting`
- [ ] iOS backups: device-only data in AsyncStorage is probably included in iCloud and phone-to-phone backups (nothing opts it out), which contradicts ADR 0005 and Privacy Policy 2.6. Confirm on a device, then either exclude it from backup or correct the policy (bump `LEGAL_VERSIONS.privacy`)
- [ ] Clinical advisor review of the coach messages and cheers (`docs/CLINICAL.md` has none approved yet)
- [ ] Native-speaker review of the Spanish strings and of the pt-BR strings added on 2026-11-11
- [ ] Decide on Apple Sign-In (App Store guideline 4.8) before submitting
- [ ] Create the app in App Store Connect; fill `APP_STORE_ID` (`lib/legal.ts`)
- [ ] First TestFlight build (`release-testflight` skill)

## After iOS: Google Play release

Groundwork done on 2026-11-17 ([ADR 0006](decisions/0006-android-groundwork.md)): package name, camera-only permissions with the microphone blocked (guardrail checks it), backup off, `expo-system-ui`. Prebuild and the Android bundle succeed; nothing has run on Android yet.

- [ ] Register the Android SHA-1 fingerprints (debug, EAS, Play App Signing) in Firebase / Google Cloud for Google sign-in
- [ ] EAS Android development build; device pass on an Android phone (sign-in, PIN gate with fingerprint or face unlock, camera mirror, back button, glass fallback, keyboard on forms)
- [ ] Legal: name Android and Google Play in the Privacy Policy and Terms (bump `LEGAL_VERSIONS`)
- [ ] Google Play Console: app, Families Policy / target audience, Data safety form, content rating, store listing in pt-BR, en, es
- [ ] First internal-testing build on Google Play

## Later

- Subscriptions: RevenueCat (needs the Terms paid-plan section first)
- Session state machine hook (`useBrushingSession`), sounds

## Ruled out or parked

- Face/mouth/zone detection — **ruled out** by [ADR 0003](decisions/0003-camera-mirror-only.md) (camera is a mirror only)
- Gemini coach — **not in the app** (ADR 0003); the old client is in git history (`lib/gemini.ts`, removed 2026-11-12). Bring it back only with the steps in `CLAUDE.md` (Privacy Policy update first)

## Done

### Parental gate PIN (2026-11-13)
- [x] `ParentalGate` asks for a 4-digit PIN kept in the Keychain (`expo-secure-store`); choosing it needs Face ID / passcode (`expo-local-authentication`), with a multiplication fallback on a phone with no passcode
- [x] Growing wait from the 5th wrong try in a row (`src/data/pinLock.ts` + unit tests)

### Device-only mode, Spanish, brushing cheers (2026-11-11)
- [x] Use without an account: device store in `src/data/local.ts`, move-to-account screen, erase, legal update (ADR 0005)
- [x] Spanish (`es`) in `lib/i18n.ts`, `locales/es.json`, profile `locale`
- [x] Every screen's strings in `lib/i18n.ts` (pt-BR, en, es), including welcome, login, register, session and results
- [x] Brushing cheers on the session sticker (`cheer.*`)

### Beavo rebrand and Riacho design system (2026-11-10)
- [x] Zing → Beavo across the codebase; brand components generated from `assets/brand/*.svg`
- [x] Design tokens (`design/tokens.json` → `tailwind.preset.js`, `lib/tokens.ts`)
- [x] First-launch intro (four screens) and logo screen after the splash

### Foundation rebuild — step 3 of 3 (2026-10-31)
- [x] Brushing (Today): slot cards (1–6, grid), current slot, start button with halo, slot picking, configurable length, kid mode (gated), Edit routine (gated)
- [x] Progress: streak + best, 30-day completion rate, This Week dots per slot active that day, derived badges, Brushing History
- [x] More: Premium placeholder, Profiles, Categories, Export/Import backup (.json), Settings, Review, Legal, Account — all gated per Apple Kids rules
- [x] GlassSurface (expo-glass-effect) on floating chrome and sheets, solid fallback

### Foundation rebuild — step 2 of 3 (2026-10-31)
- [x] Overview: DentalArch card (multi-select toggle + log-for-selection corner buttons), This Year stats, Dental History row
- [x] `DentalArch`: 20 primary teeth on two elliptical arcs, shapes by type, status colors, dentist perspective, 44pt targets, VoiceOver, Reanimated entrance (Reduce Motion aware)
- [x] Tooth sheet (view/add/delete events; batch log for several teeth) and Dental History list

### Foundation rebuild — step 1 of 3 (2026-10-31)
- [x] Nested Firestore model under `users/{uid}` + repository layer `src/data/` (ADR 0004)
- [x] Security rules with field validation + emulator tests (`npm run test:emulator`)
- [x] Multiple children: add/edit/delete (parental gate), ProfilePill + picker sheet, active child persisted
- [x] Brushing slots: 3 meal defaults, edit/reorder/remove (archive when used), `slotsActiveOn(date)`
- [x] Account rights: sign out, export (share sheet), delete account (reauth + full delete)
- [x] Camera guardrail: mirror only, released on blur/background, ESLint + CI check (ADR 0003)
- [x] Terms + Privacy drafts in `legal/` (pt-BR, en), Hosting build, consent gate with re-prompt
- [x] NativeTabs shell: Overview, Brushing, Progress, More

### Phase 1 — Foundation (confirmed by the owner on 2026-10-06)
Most of this was rebuilt on the new data model in the steps above.
- [x] Register (email/password), Google sign-in, login
- [x] Child setup, home dashboard
- [x] `BrushTimer`, brushing session (`app/session.tsx` + `app/results.tsx`)
- [x] Session save with offline outbox (`lib/sync.ts` + `src/data/outbox.ts`)
- [x] Streaks, badges and progress history (now `src/data/progress.ts`)
