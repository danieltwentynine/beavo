import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocsFromServer,
  serverTimestamp,
  setDoc,
  type DocumentReference,
  type Firestore,
  type WriteBatch,
} from 'firebase/firestore';
import { z } from 'zod';

import type { Locale, UserProfile } from '@/types';

import { BACKUP_FORMAT, BACKUP_VERSION, type Backup } from './backup.ts';
import { CHILD_SUBCOLLECTIONS, childRef, childrenRef, deleteChild } from './children.ts';
import { SERVER_TIMEOUT_MS, commitInBatches, date, deleteCollection, requireServer, toPlain, withTimeout } from './firestore.ts';
import { categoriesRef } from './toothEvents.ts';

export const userRef = (db: Firestore, uid: string) => doc(db, 'users', uid);

const userSchema = z.object({
  displayName: z.string(),
  locale: z.enum(['pt-BR', 'en', 'es']),
  createdAt: date,
  consent: z
    .object({ termsVersion: z.string(), privacyVersion: z.string(), healthData: z.boolean().optional(), acceptedAt: date })
    .optional(),
});

/**
 * The parent's profile from the server, or null when it doesn't exist yet.
 * Throws when offline — callers must tell "no profile" apart from "can't tell".
 * Malformed docs read as null so the parent is simply asked to consent again.
 */
export async function fetchUserProfile(db: Firestore, uid: string): Promise<UserProfile | null> {
  const snap = await getDocFromServer(userRef(db, uid));
  if (!snap.exists()) return null;
  const parsed = userSchema.safeParse(snap.data());
  return parsed.success ? parsed.data : null;
}

export interface ConsentInput {
  displayName: string;
  locale: Locale;
  termsVersion: string;
  privacyVersion: string;
  /**
   * What the app knows about the profile: the stored one (re-consent keeps its
   * account date), null (confirmed new account), or undefined (offline: can't tell).
   */
  existing: UserProfile | null | undefined;
}

/**
 * Record the parent's acceptance: both document versions and the separate
 * children's-health-data item, timed by the server (the rules require
 * `request.time` and today's versions). Resolves on server confirmation.
 * - Known profile: the whole doc is rewritten with its own account date, which
 *   also drops fields the schema no longer has (older builds stored the email).
 * - Confirmed new account: created with today's date.
 * - Unknown (offline): merged, so an existing account date is never replaced; on
 *   a brand-new account the rules refuse it and lib/consent.ts sends it again
 *   once the server can be asked.
 */
export function saveConsent(db: Firestore, uid: string, input: ConsentInput): Promise<void> {
  const consent = { termsVersion: input.termsVersion, privacyVersion: input.privacyVersion, healthData: true, acceptedAt: serverTimestamp() };
  const profile = { displayName: input.displayName, locale: input.locale, consent };
  if (input.existing === undefined) return setDoc(userRef(db, uid), profile, { merge: true });
  const createdAt = input.existing ? Timestamp.fromDate(input.existing.createdAt) : Timestamp.now();
  return setDoc(userRef(db, uid), { ...profile, createdAt });
}

type Plain = Record<string, unknown>;

export interface DataExport {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  user: Plain | null;
  categories: Plain[];
  children: (Plain & Record<(typeof CHILD_SUBCOLLECTIONS)[number], Plain[]>)[];
}

/** Everything stored for this parent, as plain JSON. Needs a connection (server reads only, each bounded by `timeoutMs`). */
export async function exportAllData(db: Firestore, uid: string, timeoutMs: number = SERVER_TIMEOUT_MS): Promise<DataExport> {
  const plainDocs = async (ref: ReturnType<typeof collection>) =>
    (await withTimeout(getDocsFromServer(ref), 'export', timeoutMs)).docs.map((d) => ({ id: d.id, ...(toPlain(d.data()) as Plain) }));

  const userSnap = await withTimeout(getDocFromServer(userRef(db, uid)), 'export', timeoutMs);
  const children = await Promise.all(
    (await withTimeout(getDocsFromServer(childrenRef(db, uid)), 'export', timeoutMs)).docs.map(async (c) => {
      const subs = await Promise.all(CHILD_SUBCOLLECTIONS.map((sub) => plainDocs(collection(c.ref, sub))));
      return {
        id: c.id,
        ...(toPlain(c.data()) as Plain),
        brushingSlots: subs[0],
        brushingSessions: subs[1],
        toothEvents: subs[2],
      };
    }),
  );
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    user: userSnap.exists() ? (toPlain(userSnap.data()) as Plain) : null,
    categories: await plainDocs(categoriesRef(db, uid)),
    children,
  };
}

export const erasureRef = (db: Firestore, uid: string) => doc(db, 'erasures', uid);

/**
 * Delete everything under users/{uid}: each child with its subcollections, the
 * categories and the profile. Needs a connection: checked first, and every step
 * gives up after `timeoutMs` (ServerTimeoutError). Resumable: run it again
 * after any failure. Deleting the Auth user is the caller's job, after this
 * succeeds.
 * The erasure marker (erasures/{uid}) comes first: from then on the rules
 * refuse every write under users/{uid} except archiving and deleting — the
 * profile can't be recreated either — so no device can add records while this
 * runs or afterwards. Archived children (a delete that failed midway) are
 * listed too; `knownChildIds` (e.g. a pending child deletion) are cleaned even
 * if their child document is already gone.
 */
export async function deleteAllUserData(
  db: Firestore,
  uid: string,
  timeoutMs: number = SERVER_TIMEOUT_MS,
  knownChildIds: readonly string[] = [],
): Promise<void> {
  await requireServer(userRef(db, uid), timeoutMs);
  await withTimeout(setDoc(erasureRef(db, uid), { startedAt: serverTimestamp() }), 'mark erasure', timeoutMs);
  await withTimeout(deleteDoc(userRef(db, uid)), 'delete profile', timeoutMs);
  const children = await withTimeout(getDocsFromServer(childrenRef(db, uid)), 'list children', timeoutMs);
  const ids = new Set([...children.docs.map((c) => c.id), ...knownChildIds]);
  for (const id of ids) await deleteChild(db, uid, id, timeoutMs);
  await deleteCollection(db, categoriesRef(db, uid), timeoutMs);
}

/**
 * Restore a parsed backup (see backup.ts) into this account, merging by id:
 * existing docs with the same id are overwritten, nothing is deleted. Children
 * are written before their subcollections (the rules require a live child).
 * Needs a connection: checked first, and each batch gives up after `timeoutMs`
 * (merge by id makes a retry safe). Returns how many documents were written.
 */
export async function importBackup(db: Firestore, uid: string, backup: Backup, timeoutMs: number = SERVER_TIMEOUT_MS): Promise<number> {
  await requireServer(userRef(db, uid), timeoutMs);
  const set = (ref: DocumentReference, data: Record<string, unknown>) => (batch: WriteBatch) => batch.set(ref, data);

  const parents = [
    ...backup.categories.map(({ id, ...category }) => set(doc(categoriesRef(db, uid), id), category)),
    ...backup.children.map(({ id, brushingSlots: _s, brushingSessions: _x, toothEvents: _e, ...child }) => set(childRef(db, uid, id), child)),
  ];
  let written = await commitInBatches(db, parents, timeoutMs);

  const records = backup.children.flatMap((child) => {
    const ref = childRef(db, uid, child.id);
    return [
      ...child.brushingSlots.map(({ id, ...slot }) => set(doc(collection(ref, 'brushingSlots'), id), slot)),
      ...child.brushingSessions.map(({ id, ...session }) => set(doc(collection(ref, 'brushingSessions'), id), session)),
      ...child.toothEvents.map(({ id, ...event }) => set(doc(collection(ref, 'toothEvents'), id), event)),
    ];
  });
  written += await commitInBatches(db, records, timeoutMs);
  return written;
}
