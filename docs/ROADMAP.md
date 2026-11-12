# Roadmap

Source of truth for progress. Keep `CLAUDE.md` pointing here rather than ticking items there.

Status confirmed by the owner on 2026-10-06 (previously inferred from the repo: files present, `tsc` clean, `lib/*.check.mjs` passing).

## Phase 1 — Foundation (no camera, no AI)
- [x] Register screen (email/password) and Google sign-in
- [x] Login screen
- [x] Child setup (name, age, avatar) — `app/onboarding/child-setup.tsx`
- [x] Home dashboard
- [x] `BrushTimer` component
- [x] Brushing session — implemented as `app/session.tsx` + `app/results.tsx` (CLAUDE.md planned `(tabs)/brush.tsx`)
- [x] Session save with offline outbox (now `lib/sync.ts` + `src/data/outbox.ts`)
- [x] Streaks and badges (`lib/streak.ts`, `lib/badges.ts`)
- [x] Progress history

## Foundation rebuild — step 1 of 3 (2026-10-31)
- [x] Nested Firestore model under `users/{uid}` + repository layer `src/data/` (ADR 0004)
- [x] Security rules with field validation + emulator tests (`npm run test:emulator`)
- [x] Multiple children: add/edit/delete (parental gate), ProfilePill + picker sheet, active child persisted
- [x] Brushing slots: 3 meal defaults, edit/reorder/remove (archive when used), `slotsActiveOn(date)`
- [x] Account rights: sign out, export (share sheet), delete account (reauth + full delete)
- [x] Camera guardrail: mirror only, released on blur/background, ESLint + CI check (ADR 0003)
- [x] Terms + Privacy drafts in `legal/` (pt-BR, en), Hosting build, consent gate with re-prompt
- [x] NativeTabs shell: Overview, Brushing, Progress, More
- [ ] Legal review of `legal/`; fill placeholders; confirm Firestore region; `firebase deploy --only hosting`
- [ ] Wipe legacy top-level `/children` and `/sessions` test data in the console
- [ ] Rebuild the dev client (expo-localization is a native module) and run the full flow in the simulator

## Foundation rebuild — step 2 of 3 (2026-10-31)
- [x] Overview: DentalArch card (multi-select toggle + log-for-selection corner buttons), This Year stats, Dental History row
- [x] `DentalArch`: 20 primary teeth on two elliptical arcs, shapes by type, status colors, dentist perspective, 44pt targets, VoiceOver, Reanimated entrance (Reduce Motion aware)
- [x] Tooth sheet (view/add/delete events; batch log for several teeth) and Dental History list
- [ ] Verify on device (needs the step 1 rules deployed and a dev-client rebuild)

## Foundation rebuild — step 3 of 3 (2026-10-31)
- [x] Brushing (Today): slot cards (1–6, grid), current slot, start button with halo, slot picking, configurable length, kid mode (gated), Edit routine (gated)
- [x] Progress: streak + best, 30-day completion rate, This Week dots per slot active that day, derived badges, Brushing History
- [x] More: Premium placeholder, Profiles, Categories, Export/Import backup (.json), Settings, Review, Legal, Account — all gated per Apple Kids rules
- [x] GlassSurface (expo-glass-effect) on floating chrome and sheets, solid fallback
- [ ] Fill `APP_STORE_ID` (lib/legal.ts) once the app exists in App Store Connect
- [ ] Translate remaining legacy screens (welcome, auth, session, results) to pt-BR

## Before Phase 2
- [ ] Test and CI baseline (see RUNBOOK) — started
- [ ] Firestore rules reviewed against the privacy checklist
- [ ] Portuguese (BR) strings — i18n layer in `lib/i18n.ts`; legacy screens still English

## Phase 2 — Camera and AI (not started)
- [~] Face/mouth detection — **ruled out** by [ADR 0003](decisions/0003-camera-mirror-only.md) (camera is a mirror only)
- [~] Gemini coach — client exists in `lib/gemini.ts`, **disabled** (ADR 0003); re-enable only with a Privacy Policy update
- [ ] Clinical advisor review of all coach templates

## Phase 3 — Subscriptions (not started): RevenueCat
## Phase 4 — Android (not started)

## Device-only mode, Spanish, brushing cheers (2026-11-11)
- [x] Use without an account: device store in `src/data/local.ts`, move-to-account screen, erase, legal update (ADR 0005)
- [x] Spanish (`es`) in `lib/i18n.ts`, `locales/es.json`, profile `locale`; welcome, login, register, session and results moved into `lib/i18n.ts` (all three languages)
- [x] Brushing cheers on the session sticker (`cheer.*`)
- [ ] Deploy `firestore.rules` (now accepts `locale: 'es'`) **before** a Spanish device signs in — the deployed rules refuse the consent write otherwise
- [ ] Native-speaker review of the Spanish strings and of the pt-BR strings added here; clinical review (see CLINICAL.md)
- [ ] Simulator pass of the device-only flows: use without an account → child → session; create account → move data; erase

