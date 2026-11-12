# Zing — AI Dental Coach for Kids
> Single source of truth for every coding agent in this repo (Claude Code, Codex, etc.). `AGENTS.md` only points here — edit this file, never duplicate its content elsewhere. Read this entire file before making any change.

**Expo has changed.** Before writing Expo code, read the versioned docs at https://docs.expo.dev/versions/v57.0.0/ — don't rely on memory of older SDKs.

## What is Zing?

Zing is an iOS-first mobile app that uses the phone camera to coach children through proper teeth brushing in real time. The AI watches the brushing session via camera, maps which zones of the mouth were brushed, and delivers a personalized, kid-friendly coaching message at the end. The app is built by a dentist mother and her developer son.

**Core loop:**

1. Parent sets up child profile (age, name, avatar)
2. Child opens the app, positions phone so camera sees their mouth
3. 2-minute brushing session with live zone detection overlay
4. AI coaching message generated after session ("You missed your back teeth!")
5. Streaks, badges, and rewards to build the habit

**Target user:** Children ages 4–12. Parents manage accounts. UI must be playful, simple, and work without reading skills for younger children.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | React Native + Expo SDK 57 | iOS-first, Android later, single codebase |
| Language | TypeScript (strict mode) | Required everywhere, no `any` |
| Navigation | Expo Router (file-based) | App directory structure |
| Backend | Firebase JS SDK v12 (Firestore + Auth + Storage) | Free tier sufficient for MVP |
| Camera | react-native-vision-camera v5 (per ADR 0002; needs a development build) | Per-frame processing for live detection |
| AI Model (camera) | TBD — Phase 2 spike decides (ADR 0002). `react-native-mediapipe` is unproven here | Brush zone detection, on-device |
| AI Coach (text) | Google Gemini Flash API (verify current model name before Phase 2 — the 1.5 series is being retired) | Free tier |
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
├── _layout.tsx                   # Fonts, auth subscription, outbox flush
├── index.tsx                     # Redirect: signed in → (tabs)/home, else onboarding/welcome
├── (auth)/ login.tsx, register.tsx
├── (tabs)/ home.tsx, progress.tsx
├── onboarding/ welcome.tsx, child-setup.tsx
├── session.tsx                   # Brushing session (replaces the planned (tabs)/brush.tsx)
└── results.tsx                   # Score, coach message, save status
components/
├── brand/ZingBrand.tsx
├── brushing/ MouthMap.tsx, BrushTimer.tsx, CoachCard.tsx
├── kids/ Avatar.tsx, BadgeCard.tsx, StreakDisplay.tsx, Sticker.tsx
└── ui/ Badge, Button, Card, Chip, Input, SafeScreen, SectionTitle
hooks/useActiveChild.ts
lib/
├── firebase.ts, socialAuth.ts    # Firebase init, Google Sign-In
├── children.ts, sessions.ts      # Firestore reads/writes
├── outbox.ts                     # Offline queue so finished sessions are never lost
├── localData.ts, localStore.ts   # Device-only mode (no account): codec + AsyncStorage (ADR 0003)
├── streak.ts, badges.ts
├── coach.ts                      # Local coach message — fallback when Gemini fails
├── gemini.ts                     # Gemini Flash client + prompt/sanitizer
├── constants.ts, tokens.ts       # Zone map, timing; design tokens
└── *.check.mjs                   # Plain-node self-checks (see Commands)
stores/ authStore.ts, childStore.ts, sessionStore.ts   # Zustand
types/ index.ts                   # All shared types; firebase-auth.d.ts augments RN persistence
```

Not built yet: `useBrushingSession`, `useZoneDetection`, `useCoachMessage`, `ZoneAlert`, `assets/characters|sounds` (Phase 2+).

---

## Core Types

```typescript
// Always use these types. Do not create parallel type definitions.

type ToothZone =
  | 'top-front' | 'top-left' | 'top-right' | 'top-back-left' | 'top-back-right'
  | 'bottom-front' | 'bottom-left' | 'bottom-right' | 'bottom-back-left' | 'bottom-back-right';

interface ChildProfile {
  id: string;
  parentUid: string;
  name: string;
  age: number;
  avatarId: string;
  streakCurrent: number;
  streakBest: number;
  totalSessions: number;
  badges: Badge[];
  createdAt: Date;
}

interface Badge {
  id: string;
  name: string;
  earnedAt: Date;
  type: 'streak' | 'perfect' | 'firstSession' | 'weeklyGoal';
}
```

---

## Firebase Schema

```
/users/{uid}/
  - email: string
  - displayName: string
  - createdAt: Timestamp

/children/{childId}/
  - parentUid: string
  - name: string
  - age: number
  - avatarId: string
  - streakCurrent: number
  - streakBest: number
  - totalSessions: number
  - badges: Badge[]

/sessions/{sessionId}/
  - childId: string
  - parentUid: string
  - startedAt: Timestamp
  - completedAt: Timestamp
  - durationSeconds: number
  - zonesDetected: string[]
  - zonesCoverage: Record<string, number>
  - score: number
  - coachMessage: string
```

**Firestore rules:** A parent can only read/write their own children and sessions. Children never authenticate directly — only parents do.

---

## Gemini Coach Integration (implemented in `lib/gemini.ts`)

- Model `gemini-3.5-flash-lite` (constant `GEMINI_MODEL` — re-check https://ai.google.dev/gemini-api/docs/deprecations before each release).
- `generateCoachMessage(childName, { age, missedZones, score, streakDays, locale })` returns a sanitized message or `null`. It is the only place Gemini is called.
- **The child's name never leaves the device**: the prompt uses the token `{NAME}`, substituted locally after the reply. Only age, up to 2 missed zones, score and streak are sent.
- Replies are rejected (→ fallback) if empty, over 300 chars, or containing clinical/brand wording (`BANNED` regex — clinical advisor owns this list). Capped at 2 sentences.
- `app/session.tsx` awaits it (4 s timeout) in `finish()`; on `null` it uses `lib/coach.ts`. Never show an error to the child.
- Self-check: `node lib/gemini.check.mjs`.
- Known gap: `EXPO_PUBLIC_GEMINI_API_KEY` ships in the bundle. Before App Store, proxy via a Firebase Function + App Check.

**Fallback:** If Gemini API fails or is rate-limited, use the local message bank in `lib/constants.ts`. Never show an error to the child.

---

## The Mouth Map (MouthMap.tsx)

This is the most important UI component. It is an SVG overlay displayed on top of the camera feed.

- 10 zones total (see `ToothZone` type)
- Default state: all zones gray/empty
- As zones are detected: fill progressively (light cobalt `zoneActive`)
- Fully brushed zone: solid cobalt + checkmark icon; every zone has a 3px ink outline
- At session end: show missed zones highlighted in soft orange (never red — too alarming for kids)
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

Toy box design system, adopted 2026-10-24 from the Claude Design code export (`zing-design-system.zip`). Values live in `lib/tokens.ts` (inline styles/SVG) and `tailwind.preset.js` (classes) — the preset is generated; regenerate it rather than hand-editing.

**Palette:**
- Primary: `#2D5BFF` (cobalt) — main brand color, brushing success. Press: `#1F45DB`
- Secondary: `#D6247A` (bubblegum-600) · Reward: `#FFD23F` (sunny)
- Background: `#FFF6DA` (warm cream) — main screen bg · Surface: `#FFFFFF`
- Ink: `#14142B` — headings, outlines, hard shadows · Text Secondary: `#55557A`
- Warning: `#FFB347` — missed zones / retry (warm orange, never red)
- Danger `#DC2626`: parent-facing auth errors only, never shown to children

**Signature (non-negotiable):** every card, button, tile and sticker gets a 3px ink outline + hard drop shadow (`hardShadow()` / `outline` in `lib/tokens.ts`, `boxShadow: '0 6px 0 #14142B'`). No blurred shadows, no gradients. Press feedback = scale 0.96 and the drop shrinks. Only stickers tilt (±3–6°). Touch targets ≥ 48px, controls 56px.

**Contrast:** white text only on cobalt-500/600 and bubblegum-600. Sunny and bubblegum-500 always take ink text.

**Typography:** static weights — choose the family, never `fontWeight`.
- `Fredoka` (Bold / SemiBold / Medium) — headings, numbers/scores, buttons
- `Lexend` (Regular / SemiBold) — body (min 16px) and labels

**Logo vs mascot:** the logo is the tooth with the lightning bolt (`ZingMark`, `ZingLockup`). Sparky (the foam bubble) is the mascot — splash, empty states, rewards, coaching. Never redraw either; use `components/brand/ZingBrand.tsx`.

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
- Use Zod schemas to validate all Firestore reads — data can be malformed
- Use `expo-constants` for environment variables, never hardcode API keys
- Write self-documenting code — prefer clear names over comments
- Use NativeWind classes, never raw StyleSheet unless performance demands it

### Never:
- Show error stack traces or technical messages to the child user
- Request camera permissions without explaining why first (parent sees the prompt)
- Store session video or images — only derived zone data
- Call Gemini with the child's real name in a way that could be logged externally
- Use `console.log` with sensitive data (auth tokens, child names)
- Create new TypeScript types that duplicate the ones in `types/index.ts`
- Use `useEffect` with missing dependencies — fix the dep array properly

### Privacy (critical — this is a children's app):
- COPPA compliance: parents authenticate, children never do. In device-only mode nobody authenticates and nothing is stored off the device. The Gemini coach call is the same as with an account: age, up to 2 missed zones, score and streak, never the name
- No analytics that track individual children by name
- Session data in Firestore is keyed by `parentUid` — always enforce this in security rules
- Camera frames are processed on-device and never uploaded
- The Gemini prompt must never include the child's last name, school, or location

---

## Project knowledge (read before changing an area)

Progress lives in `docs/ROADMAP.md`, decisions in `docs/decisions/`, copy rules in `docs/CLINICAL.md`, checks and releases in `docs/RUNBOOK.md`. Skills in `.claude/skills/`; the `privacy-reviewer` agent in `.claude/agents/` should review diffs touching Firestore, auth, logging, camera, or Gemini. If these docs and the code disagree, fix or flag the stale one.

---

## Current Phase: Phase 1 — Foundation (code complete, pending end-to-end simulator pass)

All seven Phase 1 items have code in the repo (register, login incl. Google Sign-In, child-setup, home, BrushTimer, session + results with Firestore save and offline outbox, progress). Streaks and badges are implemented. Item 6 landed as `app/session.tsx` + `app/results.tsx` rather than `(tabs)/brush.tsx`.

**Next:** run the full flow in the simulator (register → child setup → session → results → progress), fix what breaks, then start Phase 2.

**What NOT to build yet:**
- Camera integration (Phase 2)
- Zone detection AI (Phase 2)
- Subscriptions/RevenueCat (Phase 3)
- Android-specific code (Phase 4)

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
EXPO_PUBLIC_GEMINI_API_KEY=
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

Self-checks (plain node + assert, no framework): `node lib/streak.check.mjs`, `node lib/badges.check.mjs`, `node lib/outbox.check.mjs`, `node lib/gemini.check.mjs`, `node lib/localData.check.mjs`. Add one next to any new non-trivial pure logic. Run streak under a DST zone too: `TZ=America/New_York node lib/streak.check.mjs`.

There is no linter configured. `tsc --noEmit` plus the self-checks are the gates.

**Simulator:** this is a dev-client project — use `npx expo run:ios`, never `expo start --ios` or `--go` (Expo Go can't load the native modules).

**`.npmrc` / install scripts:** `package.json` `allowScripts` is the authority for postinstall scripts. Don't set `allow-scripts=true` in `.npmrc`; add allowances to `allowScripts`.

## Implementation Notes (learned during setup)

- Entry point is `expo-router/entry` (set in `package.json` `main`); the template's `App.tsx`/`index.ts` were deleted.
- Path alias `@/*` maps to the repo root (see `tsconfig.json`). Use it for all cross-directory imports.
- NativeWind v4 is wired through `babel.config.js` (`jsxImportSource: 'nativewind'` + `nativewind/babel`), `metro.config.js` (`withNativeWind` with `global.css`), and `tailwind.config.js` (`presets: [nativewind/preset, ./tailwind.preset]` supplies the design-system colors, fonts, radii and `shadow-toy*`/`border-toy`; app-only aliases `ink`, `muted`, `danger` live in the config).
- Firebase Auth uses `initializeAuth` + `getReactNativePersistence(AsyncStorage)` in `lib/firebase.ts`. The firebase v12 wrapper's web typings omit `getReactNativePersistence` (it exists in the RN runtime build) — `types/firebase-auth.d.ts` augments the module; do not work around it with `@ts-ignore`.
- Fonts are bundled TTFs in `assets/fonts/` loaded once in `app/_layout.tsx` via `expo-font` `useFonts`, referenced by family name: `font-display` → `Fredoka-Bold`, `font-display-semi` → `Fredoka-SemiBold`, `font-body` → `Lexend-Regular`, `font-body-semi` → `Lexend-SemiBold`, `font-numeric` → `Fredoka-Bold` (inline styles: `font.*` in `lib/tokens.ts`).
- Auth state flows: `onAuthStateChanged` subscription in `app/_layout.tsx` → `stores/authStore.ts` (Zustand) → `app/index.tsx` redirects to `(tabs)/home` when there is an owner, else `onboarding/welcome`.
- Device-only mode (ADR 0003): a parent can use Zing without an account. The owner is then the reserved id `LOCAL_UID` and `lib/children.ts` / `lib/sessions.ts` branch on it to AsyncStorage (`lib/localStore.ts`) — nothing is written to Firestore. Always take the owner from `ownerIdOf` in `stores/authStore.ts`, never `user.uid` directly. Signing in to an account with no child offers to move the device data into it — the parent must confirm, since the person signing in may not be the parent whose child is on the phone (`moveLocalDataToAccount`, called from `useActiveChild`).
- NativeWind 4.2.5 drops function-form `Pressable` styles (upstream #1105); `Button`, `Chip`, `Card` and `AvatarPicker` keep pressed state in React state instead — don't revert it.
- Fabric: don't make style *keys* conditional on focus (it recreates the native view and drops `TextInput` focus). Keep the keys, change the values.
- Finished sessions go through `lib/outbox.ts` so an offline write is retried, not lost. Session docs are idempotent via a stable id; `totalSessions` is an increment, guarded by `inFlight` in `sessionStore`.

---

## Contact & Domain Knowledge

**App concept:** Daniel Cardoso (developer) + his dentist mother (clinical advisor)
**Primary clinical advisor:** Reviews all coaching message templates for accuracy
**Target launch:** App Store, iOS first, Portuguese (BR) + English

When generating coaching messages or dental content, flag anything that sounds like medical advice for review by the clinical advisor before shipping.
