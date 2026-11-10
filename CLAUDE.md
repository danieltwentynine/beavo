# Beavo — AI Dental Coach for Kids
> Single source of truth for every coding agent in this repo (Claude Code, Codex, etc.). `AGENTS.md` only points here — edit this file, never duplicate its content elsewhere. Read this entire file before making any change.

**Expo has changed.** Before writing Expo code, read the versioned docs at https://docs.expo.dev/versions/v57.0.0/ — don't rely on memory of older SDKs.

## What is Beavo?

Beavo is an iOS-first mobile app (Brazil first, pt-BR default) that coaches children through a 2-minute guided brushing session. The front camera can act as a **mirror** so the child sees themselves — it never captures or analyzes anything (see Camera guardrail). The app is built by a dentist mother and her developer son.

**Core loop:**

1. Parent signs in (Google or email), accepts Terms + Privacy Policy, adds one or more child profiles (name, avatar, optional birth year)
2. Each child has brushing slots tied to meals (after breakfast / lunch / dinner by default, editable)
3. Child starts a 2-minute guided session (timer + mouth-zone guide), optionally with the camera mirror
4. Session is saved against the slot active at that time; a local, reviewed message closes it (no AI tips)
5. Streaks, badges, and rewards to build the habit (being rebuilt on the new data model in step 2)

**Target user:** Children ages 4–12. Parents manage accounts. UI must be playful, simple, and work without reading skills for younger children.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | React Native + Expo SDK 57 | iOS-first, Android later, single codebase |
| Language | TypeScript (strict mode) | Required everywhere, no `any` |
| Navigation | Expo Router (file-based) | App directory structure |
| Backend | Firebase JS SDK v12 (Firestore + Auth + Storage) | Free tier sufficient for MVP |
| Camera | react-native-vision-camera v5, **preview only** (ADR 0003; needs a development build) | Live mirror; no capture, no frame processing |
| AI Coach (text) | Gemini client kept in `lib/gemini.ts` but **not called** (ADR 0003) | Re-enable only with a privacy-policy update |
| i18n | `lib/i18n.ts` (`t()`, pt-BR default, English if the device is English) + `expo-localization` | No i18n library needed |
| Subscriptions | RevenueCat | Free until $2,500 MRR |
| Styling | NativeWind (Tailwind for RN) | Consistent design system |
| State | Zustand | Lightweight, no boilerplate |
| Forms | React Hook Form + Zod | Validation on all user inputs |
| Build | EAS Build (Expo) | Free tier: 15 iOS builds/month |

---

## Project Structure

Actual layout (the repo root is the project; ignore any older `fable/` naming):

```
app/                              # Expo Router screens
├── _layout.tsx                   # Fonts, auth → consent check, child data sync, outbox flush, child-picker sheet
├── index.tsx                     # Redirect: signed in → (tabs)/overview, else onboarding/intro (first launch) or onboarding/welcome
├── (auth)/ login.tsx, register.tsx
├── (tabs)/ _layout.tsx (NativeTabs + first-run gates), overview, brushing, progress, more
├── onboarding/ intro.tsx (first launch only), welcome.tsx
├── consent.tsx                   # Terms + Privacy acceptance (unchecked box, re-prompt on version change)
├── child-form.tsx                # Add (gated) / edit / delete (gated) a child
├── child-picker.tsx              # Form sheet opened by ProfilePill
├── slots.tsx                     # Edit the active child's brushing slots
├── tooth-sheet.tsx               # Form sheet: one tooth's records + add, or log for several teeth
├── dental-history.tsx            # All tooth events, newest first
├── brushing-history.tsx          # All brushing sessions, newest first
├── categories.tsx, settings.tsx, premium.tsx   # Parent-only (reached through the gate in More)
├── session.tsx                   # Brushing session
└── results.tsx                   # Score, local message, save status
components/
├── brand/ BeavoBrand.tsx (generated), LogoScreen.tsx
├── brushing/ MouthMap, BrushTimer, CoachCard, CameraBackdrop (mirror), CameraGate, SlotIcon
├── kids/ Avatar, BadgeCard, StreakDisplay, Sticker, ProfilePill
├── teeth/ DentalArch (+ legend; CHART_PERSPECTIVE), toothName
└── ui/ Badge, Button, Card, Chip, Input, SafeScreen, SectionTitle, ParentalGate (+ useParentalGate), TabHeader, ListRow, GlassSurface
hooks/ useActiveChild.ts, useChildDataSync.ts, useToothEvents.ts, useCategories.ts, useSessions.ts
src/data/                         # REPOSITORY LAYER — the only code that touches Firestore
├── children.ts, slots.ts, sessions.ts, toothEvents.ts (+ categories), account.ts (profile, consent, export, delete-all)
├── firestore.ts                  # Shared helpers (Timestamp parsing, background writes, batched collection delete)
├── schedule.ts                   # Pure slot logic: defaults, slotsActiveOn(date), pickSlotForTime, archive-vs-delete
├── teeth.ts                      # Pure tooth logic: primary FDI teeth, arch geometry/shapes, nearestTooth, stats
├── progress.ts                   # Pure: week dots, streak (all slots completed), 30-day completion rate, derived badges
├── backup.ts                     # Pure: backup file format + validation (import)
├── outbox.ts                     # Pure outbox codec for unsynced sessions
└── *.test.ts                     # node --test unit tests
lib/
├── firebase.ts, socialAuth.ts    # Firebase init, Google Sign-In (+ reauth for account deletion)
├── account.ts                    # Sign out, data export, delete child / account (app glue over src/data)
├── consent.ts, legal.ts          # Consent check/accept; LEGAL_VERSIONS + hosted URLs
├── sync.ts                       # AsyncStorage outbox: sessions survive app kill offline, retried on launch/foreground
├── i18n.ts                       # t(), pt-BR + en strings
├── coach.ts, gemini.ts (not called), constants.ts, tokens.ts
└── *.check.mjs                   # Plain-node self-checks
stores/ authStore.ts (user + consent), childStore.ts (children, slots, active child, device snapshot), sessionStore.ts, settingsStore.ts (device: brushing length, intro seen)
tests/ rules.test.ts, repository.test.ts   # Firestore emulator tests
legal/                            # Terms + Privacy Policy drafts (pt-BR, en) → public/legal/*.html on Firebase Hosting
types/ index.ts                   # All shared types; firebase-auth.d.ts augments RN persistence
```

Not built yet: `useBrushingSession`, `ZoneAlert`, `assets/characters|sounds`.

**DentalArch (`components/teeth/DentalArch.tsx`):** primary teeth only (FDI 51–85), drawn in react-native-svg from the pure geometry in `src/data/teeth.ts`. The chart uses the **dentist perspective** (`CHART_PERSPECTIVE`: the child's right is on the screen's left) — change it only there. Touches resolve to the nearest tooth within a 44pt circle; VoiceOver gets one labelled 44pt element per tooth. Glow is a translucent halo.

---

## Core Types

All shared types live in `types/index.ts` — `Child`, `BrushingSlot`, `BrushingSession`, `ToothEvent`, `Category`, `UserProfile`, `Consent`, `ToothZone`, `Badge`. Use them; do not create parallel definitions. Zod schemas for reads live next to each repository in `src/data/`.

---

## Firebase Schema

Everything lives under the parent's uid (ADR 0004). Firestore region: southamerica-east1.

```
users/{uid}                         displayName, locale ('pt-BR'|'en'), createdAt,
                                    consent { termsVersion, privacyVersion, acceptedAt }
  children/{childId}                name, avatarColor (#hex), avatarIcon, birthYear?, kidMode, createdAt, archivedAt
    brushingSlots/{slotId}          label, icon, mealType (breakfast|lunch|dinner|custom),
                                    windowStart, windowEnd ("HH:mm"), sortOrder, createdAt, archivedAt
    brushingSessions/{sessionId}    slotId, date (local YYYY-MM-DD), startedAt, durationSec, completed
    toothEvents/{eventId}           fdi, type (symptom|treatment), categoryId, note, date
  categories/{categoryId}           name, type, color, isDefault
```

- **Repository rule:** screens never import `firebase/firestore`; they call `src/data/*` (functions take `db` first so the emulator tests can pass their own).
- **Offline:** the JS SDK can't persist its cache on React Native. Writes are fired without awaiting (they show instantly via `watch*` listeners and sync on reconnect); sessions also go through `lib/sync.ts` (AsyncStorage outbox) so an app kill offline loses nothing; `stores/childStore.ts` snapshots children + slots to the device so the app starts offline. Deletes and exports need a connection (they list from the server).
- **Slots:** never hard-delete a slot with sessions — `removeSlot` archives it. Past days are evaluated with `slotsActiveOn(slots, day)` (a slot counts on every day from its creation day to its archive day, inclusive). Minimum one slot per child (client-enforced).
- **Deleting** a child or the account deletes subcollections explicitly (Firestore doesn't cascade).
- **Rules** (`firestore.rules`): owner-only under `users/{uid}`, exact keys + types on every write, `createdAt` immutable; children/categories need `users/{uid}.consent`; child subcollection writes need a live (existing, non-archived) child, so nothing can be orphaned under a deleted child; everything else denied. Tests: `npm run test:emulator`.
- **Delete order:** `deleteChild` archives the child, deletes subcollections, then the doc; `deleteAllUserData` deletes the profile first. Keep this order — the rules rely on it.

---

## Liquid Glass

NativeTabs gives the tab bar native glass on iOS 26+. Elsewhere, `components/ui/GlassSurface.tsx` is the only user of `expo-glass-effect`, and only for floating chrome: ProfilePill, Overview's corner buttons, the child-picker and tooth sheets. Never on content cards. It tints the glass per ground (`chrome` / `session`) and falls back to solid token surfaces when `isLiquidGlassAvailable()` is false or Reduce Transparency is on. Chrome keeps its soft `cardShadow` either way.

---

## Gemini Coach (disabled — ADR 0003)

`lib/gemini.ts` (+ `node lib/gemini.check.mjs`) is kept for later use but **nothing calls it**; `app/session.tsx` uses the local, clinically reviewed messages in `lib/coach.ts`. The Privacy Policy says Beavo sends no data to AI services. **Before re-enabling:** update the Privacy Policy (bump `LEGAL_VERSIONS.privacy` so parents re-consent), use a paid tier or a Firebase Function proxy + App Check (the free tier may use prompts for product improvement, and `EXPO_PUBLIC_GEMINI_API_KEY` ships in the bundle), and keep the existing rules: the child's name never leaves the device (`{NAME}` token), only age/missed zones/score/streak are sent.

---

## Camera guardrail (non-negotiable — ADR 0003)

The camera is a **live mirror only**. It must never capture, record, save, upload, or analyze frames, and never use the microphone.

- Only `components/brushing/CameraBackdrop.tsx` renders `<Camera>` (react-native-vision-camera), with **no outputs** — no photo, video, frame, depth or object output, no frame processors, no `takePhoto`/`startRecording`/`capturePhoto*`.
- The camera runs only while the session screen is focused and the app is in the foreground (`isActive` is false otherwise).
- No microphone permission: VisionCamera v5 has no Expo config plugin, and only `NSCameraUsageDescription` is set (app.json + `locales/*.json`, pt-BR and English: "only a mirror; nothing is recorded, saved or sent").
- Enforced by `eslint.config.js` (`no-restricted-imports` / `no-restricted-properties`, "Camera guardrail" message) and `scripts/check-camera-guardrail.mjs` (no mic permission in config; no `expo-media-library`, `expo-image-picker`, `expo-camera`, frame-processor or MediaPipe packages). Never disable these inline.
- The parent sees `CameraGate` (what the camera does) before the system prompt; brushing works without the camera.
- Changing any of this needs the owner, the clinical advisor, and a Privacy Policy update first.

---

## The Mouth Map (MouthMap.tsx)

This is the most important UI component. It is an SVG overlay displayed on top of the camera feed.

- 10 zones total (see `ToothZone` type)
- Default state: all zones empty (sunken blue-grey)
- Zone being brushed: white with a thick teal ring and foam bubbles (`zoneActive`)
- Fully brushed zone: solid teal + checkmark
- At session end: missed zones turn honey yellow with the retry glyph (never red — too alarming for kids)
- The SVG must be responsive and overlay correctly on any phone screen size
- Zones animate smoothly — no harsh flickers

---

## Brushing Session State Machine (target design)

> Current implementation: `app/session.tsx` drives the timer and `stores/sessionStore.ts` holds the result and save status (`saving | pending | saved | failed`, with outbox retry). The formal IDLE→…→RESULTS machine below is not extracted into a hook yet.

The session has these states. Use a Zustand store + useReducer pattern:

```
IDLE → COUNTDOWN (3s) → ACTIVE → PAUSED → COMPLETED → RESULTS
                                  ↑_______↓
```

- `IDLE`: Camera permission check, child profile selected
- `COUNTDOWN`: 3-2-1 animation before brushing starts
- `ACTIVE`: Live detection running, timer counting down from 120s
- `PAUSED`: Session paused (phone away from face), resume prompt shown
- `COMPLETED`: 120s reached or user taps done
- `RESULTS`: Score + coach message displayed, saved to Firestore

---

## Design System

**Riacho** ("calm like a picture book"), adopted 2026-11-10 from the Beavo design system artifact (https://claude.ai/artifact/ErXwoX53UF1ie2kYGq1Ajb — its `project/README.md` is the brand book; read it before designing a screen). `design/tokens.json` is a copy of its tokens; `node scripts/build-tokens.mjs` generates `tailwind.preset.js` from it, and `lib/tokens.ts` mirrors the same values for inline styles and SVG. Change values in the design system first, then here.

**Palette:**
- Primary: `#0A746E` (teal) — buttons, links, done zones; white text on it. Press: `#075A55`. Soft: `#D3EEEA`
- Secondary: `#8FCB63` with `#1C2B1A` text · Reward: `#B83A75` (berry, white text) — stickers, badges and streaks only
- Background: `#FFF7EA` (cream) · Surface: `#FFFFFF` · Line: `#EADFCB`
- Ink: `#22302E` · Ink muted: `#58655F`
- Session: ground `#E4F1F7`, track / empty zone `#C9DCE5`, zone line `#6F8A96`
- Warning: `#F6C447` (honey yellow, never red, always with the retry glyph; text on it `#3A2A00`)
- Danger `#B3261E`: parent screens only, never in kid mode

**Surfaces:** content sits in white cards (`radius.lg`, `cardShadow`) on cream; no outlines, no gradients. Primary buttons are pills on a 3px ledge (`pressShadow`) that collapses on press. Edges that must be seen (inputs, checkboxes, empty dots) use `controlBorder`. Press feedback = scale 0.96. Motion is calm; with Reduce Motion, cross-fade instead of moving. Touch targets ≥ 48px, primary controls 56px, 44px per tooth.

**Contrast:** white text only on primary, reward, danger and ink. Every state also has its own glyph or fill, never colour alone.

**Typography:** static weights — choose the family, never `fontWeight`.
- `Baloo 2` (Bold; ExtraBold for numerals) — headings, numbers/scores, buttons
- `Nunito` (Regular / SemiBold) — body (min 16px) and labels

**Logo and mascot:** Beavo the beaver is both. The mark is his head (`BeavoMark`); the wordmark is outlined lettering (`BeavoWordmark`, never retyped in a font); `BeavoLockup` is the default; `BeavoWave` is the waving pose. Never redraw or recolour them: `components/brand/BeavoBrand.tsx` is generated from `assets/brand/*.svg` by `node scripts/build-brand.mjs`. His teeth are always bright white.

**Launch and intro:** the native splash hands off to `components/brand/LogoScreen.tsx` (same image, same spot; 1 second, then a 250 ms cross-fade), drawn as an overlay in `app/_layout.tsx`. `app/onboarding/intro.tsx` is the four-screen intro, shown until `settingsStore.introSeen` is set on this device. Glass chrome takes its tint and solid fallback from `GlassSurface`'s `ground` prop (`chrome` on parent screens, `session` in the brushing session).

**Tone (copy):**
- For children: enthusiastic, uses "!" sparingly, never clinical
- For parents: clear, reassuring, professional
- Button labels: always active verbs ("Start brushing", "See results", "Try again")
- Never use "Submit", "OK", "Cancel" — always contextual labels

---

## Rules for Claude Code

### Always:
- Use TypeScript strict mode. No `any`, no `@ts-ignore`
- Use `async/await` over `.then()` chains
- Handle all Firebase errors with try/catch and user-friendly fallback messages
- Use Zod schemas to validate all Firestore reads — data can be malformed (in `src/data/`)
- Go through the repository layer in `src/data/` — never call Firestore from screens
- Put user-facing strings in `lib/i18n.ts` (pt-BR first, English second)
- Use `expo-constants` for environment variables, never hardcode API keys
- Write self-documenting code — prefer clear names over comments
- Use NativeWind classes, never raw StyleSheet unless performance demands it

### Never:
- Show error stack traces or technical messages to the child user
- Request camera permissions without explaining why first (parent sees the prompt)
- Store, capture, record, upload or analyze camera frames, video, images or audio (Camera guardrail)
- Call Gemini at all without the steps in "Gemini Coach (disabled)"; never with the child's real name
- Use `console.log` with sensitive data (auth tokens, child names)
- Create new TypeScript types that duplicate the ones in `types/index.ts`
- Use `useEffect` with missing dependencies — fix the dep array properly

### Privacy (critical — this is a children's app):
- COPPA compliance: parents authenticate, children never do
- No analytics that track individual children by name
- All data lives under `users/{uid}` — the security rules enforce owner-only access
- Camera frames are never processed, stored or uploaded (mirror only)
- **Parental gate (Apple Kids Category):** every external link (legal, review), purchase/Premium, backup export/import, settings, categories, kid-mode change, routine editing, adding/deleting a child or tooth event, sign-out and account deletion goes through `ParentalGate` / `useParentalGate` (viewing the chart and records is open). The gate runs the action only after its modal has dismissed (iOS can't present an Alert over a dismissing modal).
- **Kid mode** (`children.kidMode`, off for new children, toggled behind the gate on Brushing): hides the More tab, makes the Overview chart view-only (no tooth sheet, no Dental History) and hides edit/add in the child picker. first-run consent is an unchecked box (`app/consent.tsx`) storing accepted versions on `users/{uid}.consent`
- Legal docs (`legal/`) must describe what the code actually does — change them (and `LEGAL_VERSIONS`) whenever data handling changes
- The Gemini prompt must never include the child's last name, school, or location

---

## Project knowledge (read before changing an area)

Progress lives in `docs/ROADMAP.md`, decisions in `docs/decisions/`, copy rules in `docs/CLINICAL.md`, checks and releases in `docs/RUNBOOK.md`, Terms/Privacy drafts in `legal/`. Skills in `.claude/skills/`; the `privacy-reviewer` agent in `.claude/agents/` should review diffs touching Firestore, auth, logging, camera, or Gemini. If these docs and the code disagree, fix or flag the stale one.

---

## Current Phase: Foundation rebuild — steps 1–3 done (data, privacy, legal, nav; Overview + tooth chart; Brushing, Progress, More)

Step 1 shipped the nested Firestore model + repository layer, multiple children with a switcher, meal-based brushing slots, consent + legal drafts, account export/delete, the camera guardrail and the NativeTabs shell (Overview, Brushing, Progress, More — Brushing/Progress are placeholders). See `docs/ROADMAP.md`.

**Next:** deploy the rules, rebuild the dev client (native modules added in steps 1–3), simulator/device pass, legal review of `legal/`.

**What NOT to build yet:**
- Zone detection AI / any frame processing (ruled out by the Camera guardrail)
- Subscriptions/RevenueCat (Phase 3)
- Android-specific code (Phase 4)
- Apple Sign-In (not now — note App Store guideline 4.8 before release)

---

## Environment Variables

Create a `.env.local` file (never commit):

```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_GEMINI_API_KEY=        # unused while Gemini is disabled
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
```

All accessed via `process.env.EXPO_PUBLIC_*` — the `EXPO_PUBLIC_` prefix makes them available client-side in Expo.

---

## Commands

The project is already bootstrapped (Expo SDK 57, blank TypeScript template) with all Phase 1 dependencies installed.

```bash
npx expo start          # Start Metro dev server (press i for iOS simulator)
npx tsc --noEmit        # Typecheck — run after every change; there is no test suite yet
npx expo export --platform ios --output-dir dist-check   # Full bundle check (delete dist-check after)
npx expo install <pkg>  # Always use this (not npm install) for Expo/RN native packages — it picks SDK-compatible versions
```

```bash
npm test                # node --test src/data/*.test.ts (pure repository logic; Node ≥ 23.6)
npm run test:emulator   # Firestore rules + repository against the emulator (needs Java)
npx expo lint           # ESLint incl. the camera guardrail rules
node scripts/check-camera-guardrail.mjs
npm run build:legal     # legal/*.md → public/legal/*.html (also Hosting predeploy; checks versions)
npm run check           # tsc + lint + unit tests + self-checks + guardrail
```

Self-check: `node lib/gemini.check.mjs`. Run the unit tests under a DST zone too: `TZ=America/New_York npm test`. Inside `src/data/`, import siblings with the `.ts` extension (`./schedule.ts`) and other code only via `import type`, so Node can run the tests without a bundler.

Legal pages deploy: `npx firebase login` once, then `npx firebase deploy --only hosting` → `https://zing-dental-app.web.app/legal/…`.

**Simulator:** this is a dev-client project — use `npx expo run:ios`, never `expo start --ios` or `--go` (Expo Go can't load the native modules).

**`.npmrc` / install scripts:** `package.json` `allowScripts` is the authority for postinstall scripts. Don't set `allow-scripts=true` in `.npmrc`; add allowances to `allowScripts`.

## Implementation Notes (learned during setup)

- Entry point is `expo-router/entry` (set in `package.json` `main`); the template's `App.tsx`/`index.ts` were deleted.
- Path alias `@/*` maps to the repo root (see `tsconfig.json`). Use it for all cross-directory imports.
- NativeWind v4 is wired through `babel.config.js` (`jsxImportSource: 'nativewind'` + `nativewind/babel`), `metro.config.js` (`withNativeWind` with `global.css`), and `tailwind.config.js` (`presets: [nativewind/preset, ./tailwind.preset]` supplies the design-system colors, fonts, radii and shadows; app-only aliases `muted`, `text-link`, `surface-page` live in the config).
- Firebase Auth uses `initializeAuth` + `getReactNativePersistence(AsyncStorage)` in `lib/firebase.ts`. The firebase v12 wrapper's web typings omit `getReactNativePersistence` (it exists in the RN runtime build) — `types/firebase-auth.d.ts` augments the module; do not work around it with `@ts-ignore`.
- Fonts are bundled TTFs in `assets/fonts/` loaded once in `app/_layout.tsx` via `expo-font` `useFonts`, referenced by family name: `font-display` and `font-display-semi` → `Baloo2-Bold`, `font-numeric` → `Baloo2-ExtraBold`, `font-body` → `Nunito-Regular`, `font-body-semi` → `Nunito-SemiBold` (inline styles: `font.*` in `lib/tokens.ts`).
- Auth state flows: `onAuthStateChanged` in `app/_layout.tsx` → `stores/authStore.ts` (user + consent status from `lib/consent.ts`) → `app/(tabs)/_layout.tsx` gates: signed in → current consent → at least one child, else redirects to welcome / consent / child-form.
- NativeWind 4.2.5 drops function-form `Pressable` styles (upstream #1105); `Button`, `Chip`, `Card` and `AvatarPicker` keep pressed state in React state instead — don't revert it.
- Fabric: don't make style *keys* conditional on focus (it recreates the native view and drops `TextInput` focus). Keep the keys, change the values.
- Finished sessions go through `lib/sync.ts` (outbox codec in `src/data/outbox.ts`) so an offline write is retried, not lost. Session docs are idempotent via a stable id reserved before the first attempt.
- TypeScript 6 defaults `types` to `[]`: test files add `/// <reference types="node" />`.

---

## Contact & Domain Knowledge

**App concept:** Daniel Cardoso (developer) + his dentist mother (clinical advisor)
**Primary clinical advisor:** Reviews all coaching message templates for accuracy
**Target launch:** App Store, iOS first, Portuguese (BR) + English

When generating coaching messages or dental content, flag anything that sounds like medical advice for review by the clinical advisor before shipping.
