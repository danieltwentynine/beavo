# 0007. Fix Sprint v1: score, identifiers, tab name, consent hardening

- Status: Accepted (owner decisions relayed 2026-11-22); parent-verification method still open
- Date: 2026-11-22

(Numbered 0007: `0006-android-groundwork.md` exists on branch `claude/zen-clarke-4gdqv9`.)

## Context
The full repo review of 2026-11-21 (snapshot `ea9fb01`) raised four decisions only the owner could make (results score, what counts as "completed", the final bundle id, the More tab's name), plus release blockers in consent and identifiers. The owner approved Fix Sprint v1 and decided the points below.

## Decision
1. **Score stays /100.** It is the share of guide zones reached in the chosen length (`scoreSession` in `src/data/score.ts`, unit-tested).
   - A run whose chosen length is shorter than the recommended 2 minutes (60 or 90 s) still counts as **completed** when the full chosen length ran.
   - Its score is capped at **90** (`SHORT_RUN_SCORE_CAP`) — **placeholder — needs owner confirmation** — so it never reaches 100 or the perfect message (`coach.perfect` now needs a score of 100, `isPerfectScore`).
   - The cap value comes from the design spec (Iris) and still needs the owner's confirmation.
   - `SessionResult.totalSec` carries the chosen length, so Results can explain the cap.
2. **Identifiers.** iOS `bundleIdentifier` and Android `package` are both `com.dcrds.beavo` (2026-11-22).
   - History: Apple refused `com.beavo.app` as "not available" because another team owns it; the owner then chose `com.dcrds.beavo` for both platforms.
   - Firebase `beavo-dental` has an iOS app for `com.dcrds.beavo` (`1:1046400663421:ios:35857bd8f14d94a766d614`), with its own auto-created Google iOS OAuth client. `.env.local` already points `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` to that client.
   - The JS SDK uses the beavo-dental *web* app id, so `EXPO_PUBLIC_FIREBASE_APP_ID` is unchanged.
   - The Firebase Android app is still registered for the old id: register a new Android app for `com.dcrds.beavo` before the first Android build.
   - The owner can delete the old iOS apps in Firebase (the two earlier ids).
   - **EAS project:** `@dnlcrds/beavo` (2026-11-22, `eas init --id 8e404b74-…`, run at the owner's request). `slug` is `beavo`, `owner` is `dnlcrds`, and `extra.eas.projectId` points to the new project. Earlier projects `@zing-dental-ai/zing` and `@zing-dental-ai/beavo` are no longer linked (not deleted).
3. **Tab name.** The More tab shows **Grownups / Adultos / Adultos** (pt-BR / en / es keys `tabs.more`, `more.title`; owned by Quill and Pixel), matching the PIN and gate wording.
4. **Consent hardening (code).**
   - Two separate, required, highlighted items: Terms + Privacy, and children's health (dental) records.
   - The rules accept a new consent only with today's document versions (pinned in `firestore.rules`, checked against `LEGAL_VERSIONS` by a test), `healthData: true` and `acceptedAt == request.time`.
   - The device marks consent confirmed only after the server confirms it, and re-sends an unconfirmed one. Unconfirmed is its own status, `pending`: it keeps the app on the consent screen, so no child data can be entered. A refusal drops it and asks again.
   - Child-data writes need a *current* receipt: today's versions and `healthData`. An older receipt authorizes nothing until the parent re-consents, which the app asks for at launch.
   - Accepting is behind the grown-ups check (PIN or question). This is not parent verification (point 5).
   - Account erasure writes `erasures/{uid}` first. The rules then refuse every write under `users/{uid}` except archiving and deleting, including recreating the profile, and the client can never remove the marker.
   - Deletes that are cut off offline are remembered and finished on reconnect, and the parent is told the real outcome.
   - The Google iOS URL scheme is derived from `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` at prebuild (`plugins/withGoogleSignInScheme.js`), not at config-read time, so `eas init` works without the variable.
5. **Lawyer review is open.** How a parent is *verified*, rather than merely asked, is not decided. A checkbox anyone holding the phone can tick is not verification. Also open with counsel:
   - the COPPA scope
   - the LGPD health-data basis
   - ECA Digital (Lei 15.211) duties
   - GDPR/UK scope
   - retention
   - Terms §7/§10
   - the international-transfer clause

   Until counsel answers, cloud collection stays behind the two consent items only.

## Alternatives considered
- Drop the score entirely (it contradicts Terms §2 and CLINICAL.md "no scores"): the owner chose to keep /100. Quill aligns the copy.
- Count short runs as not completed: rejected; the child did what the parent set.
- Change the slug now and create the EAS project later: it breaks every EAS command until then, so it waits for the owner.
- Server-side recursive erasure (Cloud Function): out of scope for this sprint. Instead, the rules block every write except archiving and deleting once the profile is gone, and allow deleting only an archived child. Emulator tests cover interrupted and concurrent deletion.

## Consequences
- Bumping `LEGAL_VERSIONS` now also means bumping the two version functions in `firestore.rules` and deploying the rules with that app release (RUNBOOK).
- Consent records from before this change lack `healthData`, so every parent is asked once again, on their next launch.
- Still open, needing the owner:
  - (done 2026-11-22) EAS project relinked to `@dnlcrds/beavo` (owner `dnlcrds`)
  - setting `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (the auto-created iOS OAuth client of the `com.dcrds.beavo` Firebase iOS app) in each EAS environment, then testing Google sign-in on an internal build. The scheme is derived from the variable (it used to be hard-coded to project `925227389891`).
  - The erasure marker stays after deletion: it holds only the uid as the document id and a start time. A trusted worker (Cloud Function) that finishes abandoned erasures, removes the marker with the Auth user, and sweeps subcollections under a child document that is already gone (one only a modified client could create) is still open. Rules cannot check that a collection is empty.
  - confirming the cap of 90 (placeholder — needs owner confirmation; only `SHORT_RUN_SCORE_CAP` in `src/data/score.ts` changes)
  - the parent-verification method (lawyer)
- Still open, engineering:
  - encryption of device data and of the auth session in AsyncStorage
  - the remaining npm advisories, which need major upgrades (see the sprint report)
