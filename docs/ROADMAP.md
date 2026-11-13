# Roadmap

Source of truth for progress. Keep `CLAUDE.md` pointing here rather than ticking items there.

Last revised 2026-11-13. Open work comes first; finished work is under [Done](#done).

## Now: verify the foundation on a device

In dependency order.

- [ ] Deploy `firestore.rules` (now accepts `locale: 'es'`) **before** a Spanish device signs in — the deployed rules refuse the consent write otherwise
- [ ] Wipe legacy top-level `/children` and `/sessions` test data in the console
- [ ] Rebuild the dev client (native modules were added in foundation steps 1–3)
- [ ] Simulator/device pass:
  - signed-in flow: register → consent → child → session → results
  - Overview tooth chart, tooth sheet, Dental History
  - device-only flows: use without an account → child → session; create account → move data; erase
- [ ] Firestore rules reviewed against the privacy checklist
- [ ] Test and CI baseline (see RUNBOOK; `.github/workflows/ci.yml` exists) — started

## Next: TestFlight release

- [ ] Legal review of `legal/`; fill the two placeholders in the Terms (paid plan, liability); confirm Firestore region; `firebase deploy --only hosting`
- [ ] Clinical advisor review of the coach messages and cheers (`docs/CLINICAL.md` has none approved yet)
- [ ] Native-speaker review of the Spanish strings and of the pt-BR strings added on 2026-11-11
- [ ] Decide on Apple Sign-In (App Store guideline 4.8) before submitting
- [ ] Create the app in App Store Connect; fill `APP_STORE_ID` (`lib/legal.ts`)
- [ ] First TestFlight build (`release-testflight` skill)

## Later

- Subscriptions: RevenueCat (needs the Terms paid-plan section first)
- Android
- Session state machine hook (`useBrushingSession`), sounds

## Ruled out or parked

- Face/mouth/zone detection — **ruled out** by [ADR 0003](decisions/0003-camera-mirror-only.md) (camera is a mirror only)
- Gemini coach — **not in the app** (ADR 0003); the old client is in git history (`lib/gemini.ts`, removed 2026-11-12). Bring it back only with the steps in `CLAUDE.md` (Privacy Policy update first)

## Done

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
