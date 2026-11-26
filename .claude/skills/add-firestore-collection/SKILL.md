---
name: add-firestore-collection
description: Add or change Firestore data (collection, fields, queries) in Beavo with Zod validation and parent-scoped security rules. Use whenever data shape or firestore.rules change.
---

# Add or change Firestore data

COPPA/LGPD-critical: all data lives under `users/{uid}` (ADR 0004). Children never authenticate.

1. Update the shared type in `types/index.ts` (no parallel type definitions).
2. Add the repository function + Zod schema in `src/data/` (functions take `db` first; import siblings with `.ts`). **Parse every read** with `parseDocs`. Screens never import `firebase/firestore`.
3. New collections go under `users/{uid}/...` — never top-level.
4. Edit `firestore.rules`: owner-only (`isOwner(uid)`), exact keys via `shape(required, optional)`, type/size checks, immutable `createdAt`. Default is deny. Add allow + deny cases to `tests/rules.test.ts`.
5. Offline: writes return the server-ack promise; screens fire them with `background()` and read via `watch*` listeners. Deletes/exports read from the server.
6. Deleting a parent must still delete everything: add new child subcollections to `CHILD_SUBCOLLECTIONS`, new parent-level ones to `deleteAllUserData` and `exportAllData`.
7. Never store video, images, audio or camera frames.
8. Pure logic → `src/data/*.ts` with a `*.test.ts`; Firestore behavior → `tests/repository.test.ts`.
9. Update `legal/privacy-policy.*.md` if the data collected changes (and bump `LEGAL_VERSIONS`).
10. Run the checks in `docs/RUNBOOK.md`, then ask the `privacy-reviewer` agent to review the diff. Schema changes that affect existing docs need an ADR covering migration.
