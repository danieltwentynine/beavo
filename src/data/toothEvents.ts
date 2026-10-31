import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { z } from 'zod';

import type { Category, ToothEvent, ToothEventType } from '@/types';

import { parseDocs } from './firestore.ts';
import { isPrimaryTooth } from './teeth.ts';

// ---- Tooth events (health data: symptoms and treatments per FDI tooth) ----

export const toothEventsRef = (db: Firestore, uid: string, childId: string) =>
  collection(db, 'users', uid, 'children', childId, 'toothEvents');

const toothEventSchema = z.object({
  // Kids-only chart: a permanent-tooth number would have no name or place on it.
  fdi: z.number().int().refine(isPrimaryTooth),
  type: z.enum(['symptom', 'treatment']),
  categoryId: z.string(),
  note: z.string(),
  date: z.string(),
});

export function addToothEvent(
  db: Firestore,
  uid: string,
  childId: string,
  event: Omit<ToothEvent, 'id'>,
): { id: string; written: Promise<void> } {
  const ref = doc(toothEventsRef(db, uid, childId));
  return { id: ref.id, written: setDoc(ref, event) };
}

export function watchToothEvents(
  db: Firestore,
  uid: string,
  childId: string,
  onChange: (events: ToothEvent[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(toothEventsRef(db, uid, childId), (snap) => onChange(parseDocs(snap, toothEventSchema)), onError);
}

/** One event per tooth in a single atomic batch (multi-select logging). */
export function addToothEvents(db: Firestore, uid: string, childId: string, events: readonly Omit<ToothEvent, 'id'>[]): Promise<void> {
  const batch = writeBatch(db);
  for (const event of events) batch.set(doc(toothEventsRef(db, uid, childId)), event);
  return batch.commit();
}

export const deleteToothEvent = (db: Firestore, uid: string, childId: string, eventId: string): Promise<void> =>
  deleteDoc(doc(toothEventsRef(db, uid, childId), eventId));

// ---- Categories (per parent) ----

export const categoriesRef = (db: Firestore, uid: string) => collection(db, 'users', uid, 'categories');

const categorySchema = z.object({
  name: z.string(),
  type: z.enum(['symptom', 'treatment']),
  color: z.string(),
  isDefault: z.boolean(),
});

export interface DefaultCategory {
  /** Stable doc id, so seeding twice can't duplicate. */
  id: string;
  type: ToothEventType;
  color: string;
}

// Clinical advisor to review this list (docs/CLINICAL.md). Names are localized at seed time.
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { id: 'pain', type: 'symptom', color: '#FFB347' },
  { id: 'sensitivity', type: 'symptom', color: '#FFD23F' },
  { id: 'bleeding', type: 'symptom', color: '#D6247A' },
  { id: 'filling', type: 'treatment', color: '#2D5BFF' },
  { id: 'sealant', type: 'treatment', color: '#00876F' },
  { id: 'cleaning', type: 'treatment', color: '#6D4FD6' },
  { id: 'extraction', type: 'treatment', color: '#55557A' },
];

/** Write the default categories (names already localized). Run once, for a new account. */
export function seedDefaultCategories(db: Firestore, uid: string, names: Record<string, string>): Promise<void> {
  const batch = writeBatch(db);
  for (const c of DEFAULT_CATEGORIES) {
    batch.set(doc(categoriesRef(db, uid), c.id), { name: names[c.id] ?? c.id, type: c.type, color: c.color, isDefault: true });
  }
  return batch.commit();
}

/** `fromCache`: the list may be incomplete (offline) — don't treat empty as "none exist". */
export function watchCategories(
  db: Firestore,
  uid: string,
  onChange: (categories: Category[], fromCache: boolean) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(categoriesRef(db, uid), (snap) => onChange(parseDocs(snap, categorySchema), snap.metadata.fromCache), onError);
}
