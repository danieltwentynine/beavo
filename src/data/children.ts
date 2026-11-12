import {
  Timestamp,
  collection,
  doc,
  onSnapshot,
  updateDoc,
  writeBatch,
  deleteDoc,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { z } from 'zod';

import type { Child } from '@/types';

import { deleteCollection, optionalDate, date, parseDocs } from './firestore.ts';
import { LOCAL_UID, localCreateChild, localDeleteChild, localUpdateChild, watchLocalChildren } from './local.ts';
import { defaultSlots, type DefaultSlotLabels } from './schedule.ts';

/** Profile limit per parent. Infinity = unlimited. */
export const MAX_CHILDREN = Infinity;

export const CHILD_SUBCOLLECTIONS = ['brushingSlots', 'brushingSessions', 'toothEvents'] as const;

export const childrenRef = (db: Firestore, uid: string) => collection(db, 'users', uid, 'children');
export const childRef = (db: Firestore, uid: string, childId: string) => doc(db, 'users', uid, 'children', childId);

const childSchema = z.object({
  name: z.string(),
  avatarColor: z.string(),
  avatarIcon: z.string(),
  birthYear: z.number().int().nullish().transform((v) => v ?? undefined),
  kidMode: z.boolean().default(false),
  createdAt: date,
  archivedAt: optionalDate,
});

export interface ChildInput {
  name: string;
  avatarColor: string;
  avatarIcon: string;
  birthYear?: number;
}

/**
 * Create a child plus its three default brushing slots in one atomic batch.
 * The id is returned at once so the UI can select the child while offline;
 * `written` resolves when the server confirms.
 */
export function createChild(
  db: Firestore,
  uid: string,
  input: ChildInput,
  slotLabels: DefaultSlotLabels,
): { id: string; written: Promise<void> } {
  const ref = doc(childrenRef(db, uid));
  if (uid === LOCAL_UID) {
    // Firestore's id generator works offline; the ids stay valid doc ids if the
    // parent later moves this child into an account.
    const slots = defaultSlots(slotLabels).map((slot) => ({ ...slot, id: doc(collection(ref, 'brushingSlots')).id }));
    return { id: ref.id, written: localCreateChild(ref.id, input, slots, new Date()) };
  }
  const now = Timestamp.now();
  const batch = writeBatch(db);
  batch.set(ref, {
    name: input.name,
    avatarColor: input.avatarColor,
    avatarIcon: input.avatarIcon,
    birthYear: input.birthYear ?? null,
    kidMode: false, // the parent is setting up; they switch it on before handing over
    createdAt: now,
    archivedAt: null,
  });
  for (const slot of defaultSlots(slotLabels)) {
    batch.set(doc(collection(ref, 'brushingSlots')), { ...slot, createdAt: now, archivedAt: null });
  }
  return { id: ref.id, written: batch.commit() };
}

export function updateChild(
  db: Firestore,
  uid: string,
  childId: string,
  patch: Partial<ChildInput & { kidMode: boolean }>,
): Promise<void> {
  if (uid === LOCAL_UID) return localUpdateChild(childId, patch);
  const { birthYear, ...rest } = patch;
  return updateDoc(childRef(db, uid, childId), {
    ...rest,
    ...('birthYear' in patch ? { birthYear: birthYear ?? null } : {}),
  });
}

/**
 * Live list of the parent's (non-archived) children, oldest first.
 * `fromCache` is true when the list may be incomplete (offline, cold cache) —
 * an empty cached list must NOT be read as "this parent has no children".
 */
export function watchChildren(
  db: Firestore,
  uid: string,
  onChange: (children: Child[], fromCache: boolean) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (uid === LOCAL_UID) return watchLocalChildren((children) => onChange(children, false));
  return onSnapshot(
    childrenRef(db, uid),
    (snap) => {
      const children = parseDocs(snap, childSchema)
        .filter((c) => !c.archivedAt)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      onChange(children, snap.metadata.fromCache);
    },
    onError,
  );
}

/**
 * Delete a child and everything under it. Needs a connection: subcollections
 * are listed from the server (Firestore does not cascade deletes).
 * Archives the child first: the rules then refuse new subcollection writes
 * (e.g. another device flushing its outbox), so nothing lands after the
 * listing. If this fails midway the archived child still exists, so a retry
 * or account deletion still finds it.
 */
export async function deleteChild(db: Firestore, uid: string, childId: string): Promise<void> {
  if (uid === LOCAL_UID) return localDeleteChild(childId);
  const ref = childRef(db, uid, childId);
  await updateDoc(ref, { archivedAt: Timestamp.now() });
  for (const sub of CHILD_SUBCOLLECTIONS) await deleteCollection(db, collection(ref, sub));
  await deleteDoc(ref);
}
