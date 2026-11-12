import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { z } from 'zod';

import type { BrushingSlot } from '@/types';

import { date, optionalDate, parseDocs } from './firestore.ts';
import { LOCAL_UID, localAddSlot, localRemoveSlot, localReorderSlots, localUpdateSlot, watchLocalSlots } from './local.ts';
import { slotRemoval, type NewSlot } from './schedule.ts';
import { hasSessionsForSlot } from './sessions.ts';

export const slotsRef = (db: Firestore, uid: string, childId: string) =>
  collection(db, 'users', uid, 'children', childId, 'brushingSlots');

const slotSchema = z.object({
  label: z.string(),
  icon: z.string(),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'custom']),
  windowStart: z.string(),
  windowEnd: z.string(),
  sortOrder: z.number(),
  createdAt: date,
  archivedAt: optionalDate,
});

/** Every slot of a child, archived ones included (past days need them). */
export function watchSlots(
  db: Firestore,
  uid: string,
  childId: string,
  onChange: (slots: BrushingSlot[]) => void,
): Unsubscribe {
  if (uid === LOCAL_UID) return watchLocalSlots(childId, onChange);
  return onSnapshot(slotsRef(db, uid, childId), (snap) => onChange(parseDocs(snap, slotSchema)));
}

export function addSlot(db: Firestore, uid: string, childId: string, slot: NewSlot): { id: string; written: Promise<void> } {
  const ref = doc(slotsRef(db, uid, childId));
  if (uid === LOCAL_UID) return { id: ref.id, written: localAddSlot(childId, ref.id, slot, new Date()) };
  return { id: ref.id, written: setDoc(ref, { ...slot, createdAt: Timestamp.now(), archivedAt: null }) };
}

export type SlotPatch = Partial<Pick<BrushingSlot, 'label' | 'icon' | 'windowStart' | 'windowEnd'>>;

export function updateSlot(db: Firestore, uid: string, childId: string, slotId: string, patch: SlotPatch): Promise<void> {
  if (uid === LOCAL_UID) return localUpdateSlot(childId, slotId, patch);
  return updateDoc(doc(slotsRef(db, uid, childId), slotId), patch);
}

/** Persist a new order: `orderedIds[i]` gets sortOrder i. */
export function reorderSlots(db: Firestore, uid: string, childId: string, orderedIds: readonly string[]): Promise<void> {
  if (uid === LOCAL_UID) return localReorderSlots(childId, orderedIds);
  const batch = writeBatch(db);
  orderedIds.forEach((id, sortOrder) => batch.update(doc(slotsRef(db, uid, childId), id), { sortOrder }));
  return batch.commit();
}

/**
 * Remove a slot: hard-delete only when the server confirms it has no sessions,
 * otherwise archive it (offline included). Callers enforce the one-slot
 * minimum with `canRemoveSlot` — rules can't count documents.
 * Resolves with the action as soon as the write is issued; `written` resolves
 * on server confirmation.
 */
export async function removeSlot(
  db: Firestore,
  uid: string,
  childId: string,
  slotId: string,
): Promise<{ action: 'archive' | 'delete'; written: Promise<void> }> {
  if (uid === LOCAL_UID) return localRemoveSlot(childId, slotId, new Date());
  const action = slotRemoval(await hasSessionsForSlot(db, uid, childId, slotId));
  const ref = doc(slotsRef(db, uid, childId), slotId);
  const written = action === 'delete' ? deleteDoc(ref) : updateDoc(ref, { archivedAt: Timestamp.now() });
  return { action, written };
}
