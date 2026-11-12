# 0005. Device-only mode (use without an account)

- Status: Accepted
- Date: 2026-11-11

## Context
Every path into the app required a Firebase account, and all child data lived under `users/{uid}` in Firestore. Some parents will not create an account for a children's app before trying it, and some do not want their child's health-related data in the cloud at all.

## Decision
The welcome screen offers "Use without an account". The owner of the data is then the reserved id `LOCAL_UID` instead of a Firebase uid, and the repositories in `src/data/` route every call for that owner to `src/data/local.ts` instead of Firestore. Screens keep calling the same repository functions; they take the owner from `ownerIdOf` in `stores/authStore.ts`.

1. **The device store is a backup file.** `src/data/local.ts` holds one `Backup` (the format of `backup.ts`) in memory and saves it as one JSON value in AsyncStorage. Every write is re-validated with `parseBackup` before it is kept, so what is on disk can always be read back. Export is the store itself; import merges by id.
2. **Consent is still required**, recorded on the device (`lib/consent.ts`).
3. **Moving to an account is never automatic.** A signed-in parent whose phone still holds device profiles is sent to `app/move-data.tsx`, which names the children and asks. Moving sits behind the parental gate, runs `importBackup` (merge by id, so a retry cannot duplicate), and clears the device only after the account confirmed every write. Declining leaves the data on the device; the question comes back on the next launch.
4. **Erasing** is in More, behind the parental gate and a confirmation.
5. **No account rows without an account:** More shows "This phone" (create an account, sign in, erase) in place of sign out and delete account.

## Alternatives considered
- Firebase anonymous auth: one code path, but it puts the data in the cloud under an account the parent never agreed to create.
- A storage interface with Firestore and AsyncStorage implementations: more structure than a branch per repository function needs.
- Moving the data silently on sign-in: whoever signs in on a shared phone would receive another family's children.

## Consequences
- Device data is lost when the app is deleted or the phone is replaced. The welcome screen, More and the Privacy Policy (section 2.6) say so; Export backup is the parent's safeguard.
- The whole store is rewritten and re-validated on every change: fine at family scale, revisit if a history makes saving slow.
- If storage cannot be read at launch, the store is deliberately not started (the app shows no children) rather than started empty, which would overwrite real data on the next save.
- Firestore rules are unchanged: device data never reaches Firestore, and moved documents go through the same validated import as a backup file.
- `legal/` describes the mode; `LEGAL_VERSIONS` was bumped to 2026-11-11.
