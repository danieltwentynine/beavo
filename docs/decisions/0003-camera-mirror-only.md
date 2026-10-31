# 0003. Camera is a mirror only; no AI tips

- Status: Accepted (2026-10-31). Supersedes the detection-layer part of [0002](0002-camera-and-zone-detection.md).
- Date: 2026-10-31

## Context
ADR 0002 kept react-native-vision-camera v5 for a future on-device zone-detection spike. For a children's app in Brazil storing health-related data under the LGPD, the owner decided the camera's only job is to let the child see themselves while brushing. AI coaching tips (Gemini) are also off: the free tier may use prompts for product improvement, and the Privacy Policy should be able to say that no data goes to AI services.

## Decision
1. **Keep react-native-vision-camera v5, preview only.** No library swap. `<Camera>` gets no outputs (photo, video, frame, depth, object), no frame processors, no capture calls. It is active only while the session screen is focused and the app is in the foreground.
2. **No microphone permission.** VisionCamera v5 has no Expo config plugin, so only `NSCameraUsageDescription` is set (pt-BR + English via `locales/`).
3. **Enforced mechanically:** ESLint `no-restricted-imports` / `no-restricted-properties` ("Camera guardrail") and `scripts/check-camera-guardrail.mjs` in CI (no mic permission in config, no capture/media/frame-processor packages).
4. **No zone detection.** The session stays timer-guided; copy must not claim detection.
5. **Gemini not called.** `lib/gemini.ts` stays in the repo for later; `app/session.tsx` uses the local templates in `lib/coach.ts`.

## Alternatives considered
- **Switch to expo-camera `CameraView`:** also preview-capable, but the owner chose not to swap libraries now. The guardrail bans `expo-camera` to avoid two camera stacks.
- **Keep the detection spike:** contradicts the privacy promise and the mirror-only product decision.

## Consequences
- Privacy Policy and Terms state "mirror only; nothing recorded, saved, sent or analyzed" and "no AI services".
- Re-enabling Gemini or any frame analysis needs a new ADR, a Privacy Policy update (new `LEGAL_VERSIONS.privacy`, so parents re-consent) and the clinical advisor.
- `react-native-vision-camera` is a frame-processor-capable library; the ESLint rules are what keep it preview-only. Revisit if VisionCamera renames its output hooks (update the banned names).
