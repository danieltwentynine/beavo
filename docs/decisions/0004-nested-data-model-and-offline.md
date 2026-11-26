# 0004. Nested per-parent data model, repository layer, offline strategy

- Status: Accepted (2026-10-31)
- Date: 2026-10-31

## Context
Phase 1 stored `/children` and `/sessions` as top-level collections keyed by a `parentUid` field, with streaks, badges and scores on the child doc. Step 1 of the foundation rebuild adds multiple children, meal-based brushing slots, tooth events and categories, account export/delete, and must keep brushing working offline.

## Decision
1. **Everything under `users/{uid}`** (children → brushingSlots / brushingSessions / toothEvents; categories). Ownership is the path, so rules are a single `isOwner(uid)` check plus field validation, and account deletion is "delete this subtree".
2. **Repository layer in `src/data/`** is the only Firestore caller. Functions take `db` first so `tests/repository.test.ts` runs them against the emulator with the real rules.
3. **No migration.** Pre-launch data in the old top-level collections is test data: the rules deny those paths, the owner wipes them in the console.
4. **Offline:** the Firebase JS SDK has no persistent cache on React Native (no IndexedDB), and `@react-native-firebase` would mean rewriting working auth. So: memory cache + fire-and-forget writes (visible at once through listeners, synced on reconnect while the app runs); an AsyncStorage **outbox** for brushing sessions (survives app kill; retried on launch and on return to foreground); an AsyncStorage **snapshot** of children + slots per parent (app starts offline). Deletes and exports read from the server and need a connection.
5. **Slots are archived, not deleted, once they have sessions.** History uses `slotsActiveOn(slots, day)`: a slot counts from its creation day to its archive day, inclusive. Times are local `"HH:mm"`, windows within one day.
6. **Rules guard against orphans and missing consent:** creating children/categories requires `users/{uid}.consent`; child subcollection writes require the child to exist with `archivedAt == null`. `deleteChild` archives first, then deletes subcollections, then the doc; `deleteAllUserData` deletes the profile first. A late write (another device's outbox, an unexpired token after account deletion) is refused instead of landing where delete/export can't see it; the outbox drops entries refused with `permission-denied`.
7. **Streaks/badges/score are not stored** in the new model; they will be derived from `brushingSessions` (step 2).

## Consequences
- Child/slot edits made offline are lost if the app is killed before reconnecting (only sessions are outboxed). Upgrade path: generalize the outbox, or move to `@react-native-firebase` with native persistence.
- Rules can't count documents: the "at least one slot" minimum is enforced in the client.
- Deleting a child or account issues one batched delete per 450 docs; fine at family scale.
