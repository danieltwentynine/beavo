# 0003. Device-only mode (use without an account)

- Status: Accepted
- Date: 2026-11-11

## Context
Every path into the app required a Firebase account, and all child and session data lived in Firestore. Some parents will not create an account for a children's app before trying it, and some will not want their child's data in the cloud at all.

## Decision
The welcome screen offers "Use without an account". The child profile, streak, badges and brushing history are then kept only on the device, in AsyncStorage, owned by the reserved id `LOCAL_UID` in place of a Firebase uid. The existing data functions in `lib/children.ts` and `lib/sessions.ts` branch on that id, so screens call the same functions in both modes.

When such a parent later creates or signs in to an account that has no child, they are asked whether to move the device data into it (`moveLocalDataToAccount`); on yes it is uploaded and removed from the device, on no it stays on the device. If the account already has a child, the account's data is shown and the device data stays on the device, unmerged.

## Alternatives considered
- Firebase anonymous auth: keeps one code path, but puts the data in the cloud under an account the parent never agreed to create, which is the opposite of what was asked.
- A storage interface with Firestore and AsyncStorage implementations: more structure than two modules with five functions need.
- Merging device and account data when both have a child: the app shows one child per parent today, so there is nothing sensible to merge into.

## Consequences
- "On the device only" is about storage. The coach message still calls Gemini with age, up to two missed zones, score and streak (never the name), exactly as with an account. Skipping Gemini in this mode and using `lib/coach.ts` is a one-line change if that is wanted.
- Device data is lost when the app is deleted or the phone is replaced. The welcome screen and the settings prompt say so.
- The settings prompt has "Erase data on this phone" (with a confirmation). It is not behind a parental gate; revisit with the parent settings screen.
- The whole device history is one JSON value rewritten per session. Revisit if a history grows past a few thousand sessions.
- Firestore rules are unchanged: device data never reaches Firestore, and moved documents carry the real `parentUid`.
