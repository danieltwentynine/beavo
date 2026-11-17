# 0006. Android groundwork alongside the iOS release

- Status: Accepted
- Date: 2026-11-17

## Context
Beavo is iOS-first and Android was planned for Phase 4. The owner asked for a Google Play version on 2026-11-17, while the iOS app was still in its device pass and had not reached TestFlight. The codebase is one Expo project, but `app.json` had no Android package name, the camera guardrail only checked iOS config, and nobody had built or run the app on Android.

Two Android-specific privacy risks came up:
- Libraries can merge permissions into the final manifest. VisionCamera's Android code can request `RECORD_AUDIO`, so leaving the microphone out of `app.json` does not keep it out of the build.
- Android Auto Backup copies app data, including AsyncStorage, to the user's Google account. In device-only mode (ADR 0005) the app promises that nothing leaves the device.

## Decision
Lay the Android groundwork now; ship iOS first and Android after it.

1. **Package name** `com.zingdentalai.zing`, the same as the iOS bundle id. It cannot change once the app is on Google Play.
2. **Permissions:** `android.permissions` is `CAMERA` only. `android.blockedPermissions` removes `RECORD_AUDIO`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` and `SYSTEM_ALERT_WINDOW` from the merged manifest. `scripts/check-camera-guardrail.mjs` fails if the microphone is not blocked.
3. **`android.allowBackup: false`**, so device-only data and the parental PIN store are not copied to Google's cloud backup. On Android 12 and later, phone-to-phone transfer ignores this flag and follows `dataExtractionRules`. Those come from expo-secure-store's config plugin (`secure_store_data_extraction_rules`) and include only shared preferences minus the PIN store, so AsyncStorage's database is not transferred. That depends on the library's default; replace it with our own rules if the default changes. The guardrail script checks `allowBackup` and that `android.permissions` is the camera only.
4. **`expo-system-ui`** is installed so the light-only `userInterfaceStyle` applies on Android too.

## Alternatives considered
- Wait for Phase 4: the owner wanted Android moving now. Config-only groundwork costs little and does not slow the iOS release.
- Full Play launch in parallel: needs Play-specific legal text and store declarations that depend on the same legal review iOS is waiting on.
- A different package name such as `com.beavo.app`: the iOS bundle id already carries the old Zing name, and matching it keeps one identity across stores. The owner chose to match.

## Consequences
- `npx expo prebuild --platform android` and an Android JS bundle succeed (checked in a container on 2026-11-17). No Android binary has been built or run yet.
- Google sign-in on Android needs the app's SHA-1 signing fingerprints (debug, EAS and Play App Signing) registered in Firebase / Google Cloud before it works.
- Turning off backup means a parent who changes phones loses device-only data on Android unless they exported a backup.
- iOS may not match: AsyncStorage lives in Application Support, which iCloud and device-to-device backups include by default, and nothing opts it out. If so, device-only data can reach the parent's iCloud backup, contrary to ADR 0005 and Privacy Policy section 2.6. Not yet checked on a device; tracked in `docs/ROADMAP.md`.
- Google Play's Families Policy, the Data safety form and the content rating apply. The Privacy Policy and Terms must name Android and Google Play before release.
- Revisit Material-specific polish (back gesture, edge-to-edge, glass fallback) after the first Android device pass.
