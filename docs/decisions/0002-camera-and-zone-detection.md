# 0002. Camera and brush-zone detection approach (Phase 2)

- Status: Camera layer (VisionCamera v5) still in use. **Detection layer superseded by [0003](0003-camera-mirror-only.md)** (2026-10-31): the camera is a mirror only, no frame processing.
- Date: 2026-10-06

## Context
Phase 2 adds live camera coaching: show the child's mouth, work out which of the 10 `ToothZone`s were brushed, and feed `zonesDetected` / `zonesCoverage` into the existing session and results flow. Constraints from `CLAUDE.md`:
- All frame processing is on-device. Frames, video and images are never stored or uploaded. Only derived zone data is saved.
- Parents authenticate; the camera permission is explained before it is requested.
- iOS first. Expo SDK 57, which means development builds, not Expo Go (already true for Google Sign-In).
- Phase 1 already ships a camera-less, timer-guided brushing session. That is our fallback.

Facts checked on 2026-10-06 (npm registry metadata and web search; re-verify before building):
- `expo-camera` 57.0.6 is current, but Expo removed face detection from it. It does not give per-frame ML processing.
- `react-native-vision-camera` 5.2.3 (modified 2026-08-20) supports frame processors. It lists `react-native-nitro-modules` and `react-native-nitro-image` as peer dependencies and needs a development build. I did not confirm its compatibility with RN 0.86 / SDK 57 beyond the loose `react-native: "*"` peer range.
- `react-native-mediapipe` 0.6.0, the library named in `CLAUDE.md`, was last published 2024-12-12 and peers on `react-native-vision-camera` and `react-native-worklets-core`. This project uses `react-native-worklets` (Reanimated 4), not `worklets-core`, and VisionCamera is now on v5. Its GitHub repo may be more active than npm suggests, but I could not confirm that. Treat it as a risk.
- `react-native-vision-camera-face-detector` 2.1.0 (2026-09-18) is a VisionCamera 5 frame processor plugin built on ML Kit face detection. It is community-maintained.
- `expo-vision-camera-v4-mediapipe` 1.4.0 (2026-09-12) wraps MediaPipe hand/pose/face landmarkers, but targets VisionCamera **v4**.

The hard, unproven part is not the camera. It is whether zone coverage can be inferred reliably: face landmarks give the mouth region and head pose, but knowing *which teeth the brush is touching* needs the toothbrush and hand position as well. No candidate was tested for that here.

## Decision
1. **Camera layer: adopt `react-native-vision-camera` v5** (replacing `expo-camera` for brushing sessions). Reason: it is the only candidate that gives per-frame processing, and it is actively released. Add it with `npx expo install` / its documented Expo setup, and check peer dependencies against the installed SDK before merging.
2. **Detection layer: do not commit yet.** Run a time-boxed spike (about 1–2 days) comparing, on a real iPhone and with a few volunteers (adults first, children only with parent consent and no stored footage):
   - A. VisionCamera 5 + ML Kit face detector plugin (face and mouth region only)
   - B. VisionCamera + MediaPipe Face + Hand landmarkers via a maintained binding, or a thin native module of our own
   - C. B plus an object detector for the toothbrush
3. **Spike pass criteria (to be confirmed by the owner and clinical advisor):** frame rate stays at or above roughly 15 fps on a mid-range iPhone; the mouth region is found in most frames at arm's length with a child's head movement; a chosen zone-attribution rule agrees with a human rater on a small labelled set. Numbers here are starting guesses, not requirements.
4. **If no approach passes, ship a degraded mode:** camera shows the mouth, the timer-guided quadrant flow stays the source of coverage, and the app does not claim per-zone detection. Marketing and copy must match what is actually detected (clinical advisor to review).
5. Update the Tech Stack table in `CLAUDE.md` once the spike decides; this ADR is then superseded or amended by 0003.

## Alternatives considered
- **`expo-camera` only:** simplest and Expo-maintained, but no frame processing, so no live detection.
- **`react-native-mediapipe` as written in `CLAUDE.md`:** stale-looking on npm and tied to the older VisionCamera / `worklets-core` stack. Not ruled out, only unproven.
- **Native Swift module (Vision / ARKit face tracking, Core ML):** best iOS performance and no JS-bridge limits, but breaks the single-codebase goal for Android later and costs more upfront. Keep as the fallback if the spike shows JS frame processing is too slow.
- **Server-side inference:** rejected by the privacy rules (no frames leave the device).

## Consequences
- Needs development builds on every machine and in CI for anything camera-related; the `release-testflight` skill and runbook should mention this.
- Adds native dependencies (VisionCamera, Nitro modules, a detector), which raises the cost of future Expo SDK upgrades.
- Camera permission flow must be built with a parent-facing explanation first (`CLAUDE.md` > Never).
- Frame processors must not persist or transmit frames; `privacy-reviewer` should review the first camera PR.
- Revisit when: the spike finishes, SDK 58 becomes `latest`, or VisionCamera / the chosen detector changes its Expo or New Architecture support.
