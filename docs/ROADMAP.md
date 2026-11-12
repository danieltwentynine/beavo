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
- [x] Session save with offline outbox (`lib/outbox.ts`, `lib/sessions.ts`)
- [x] Streaks and badges (`lib/streak.ts`, `lib/badges.ts`)
- [x] Progress history
- [x] Use without an account — data on the device only, moved into the account on sign-up ([ADR 0003](decisions/0003-device-only-mode.md)); pending a simulator pass

## Before Phase 2
- [ ] Test and CI baseline (see RUNBOOK) — started
- [ ] Firestore rules reviewed against the privacy checklist
- [ ] Portuguese (BR) strings — launch target is PT-BR + English; no i18n layer yet

## Phase 2 — Camera and AI (not started)
- [ ] Decide face/mouth detection approach — see [ADR 0002](decisions/0002-camera-and-zone-detection.md) (Proposed; needs a spike)
- [ ] `MouthMap` live overlay
- [ ] Gemini coach in `lib/coach.ts` with the local generator as fallback. Verify the current model name first; the 1.5 series is being retired
- [ ] Clinical advisor review of all coach templates

## Phase 3 — Subscriptions (not started): RevenueCat
## Phase 4 — Android (not started)
