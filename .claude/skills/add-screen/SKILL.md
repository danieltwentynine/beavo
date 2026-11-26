---
name: add-screen
description: Add a new Expo Router screen to Beavo following project conventions (NativeWind, design tokens, SafeScreen, kid-safe copy). Use when asked to build or add a screen or route.
---

# Add a screen

1. Read `docs/ROADMAP.md` and one similar existing screen in `app/` first; match its structure.
2. Read the installed Expo SDK's router docs if unsure of an API (see `docs/RUNBOOK.md` > Expo version).
3. Create the file under `app/` (file-based routing). Wrap content in `components/ui/SafeScreen`; reuse `Button`, `Card`, `Input`, etc. before creating new components.
4. Style with NativeWind classes and Tailwind tokens from `tailwind.config.js` (`primary`, `ink`, `muted`, `font-display`, `font-subhead`, `font-body`, `font-numeric`). No raw `StyleSheet` unless a measured performance need.
5. Forms: React Hook Form + Zod. Validate all input.
6. Copy: active-verb button labels ("Start brushing"), never "Submit/OK/Cancel". Child-facing screens: no errors or technical text, no red (use the warning orange). New or changed copy goes in the PR under "Needs clinical review" (`docs/CLINICAL.md`).
7. Use types from `types/index.ts`; don't redefine them. Import across directories with `@/`.
8. If routing changes, check the redirect logic in `app/index.tsx`.
9. Run the checks in `docs/RUNBOOK.md`. Update `docs/ROADMAP.md`.
