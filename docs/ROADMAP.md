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

## Foundation rebuild — steps 2–3 (next)
- [ ] Visual redesign of Overview / Brushing / Progress / More
- [ ] Streaks, badges and progress derived from `brushingSessions`
- [ ] Tooth-event UI (FDI chart, categories)
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
