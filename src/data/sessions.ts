import {
  Timestamp,
  collection,
  doc,
  getDocsFromServer,
  limit,
  onSnapshot,
  query,
  setDoc,
  where,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { z } from 'zod';

import type { BrushingSession } from '@/types';

import { date, parseDocs } from './firestore.ts';

export const sessionsRef = (db: Firestore, uid: string, childId: string) =>
  collection(db, 'users', uid, 'children', childId, 'brushingSessions');

const sessionSchema = z.object({
  slotId: z.string(),
  date: z.string(),
  startedAt: date,
  durationSec: z.number(),
  completed: z.boolean(),
});

/** Reserve an id up front so a retried save overwrites the same doc. */
export const newSessionId = (db: Firestore, uid: string, childId: string): string =>
  doc(sessionsRef(db, uid, childId)).id;

/** Idempotent in `session.id`. Resolves on server confirmation. */
export function writeSession(db: Firestore, uid: string, childId: string, session: BrushingSession): Promise<void> {
  const { id, startedAt, ...rest } = session;
  return setDoc(doc(sessionsRef(db, uid, childId), id), { ...rest, startedAt: Timestamp.fromDate(startedAt) });
}

/** Live sessions of one local day (YYYY-MM-DD). */
export function watchSessionsOn(
  db: Firestore,
  uid: string,
  childId: string,
  day: string,
  onChange: (sessions: BrushingSession[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(sessionsRef(db, uid, childId), where('date', '==', day)),
    (snap) => onChange(parseDocs(snap, sessionSchema)),
    onError,
  );
}

/** Whether any session uses the slot — asked of the server. Null when it can't be reached. */
export async function hasSessionsForSlot(db: Firestore, uid: string, childId: string, slotId: string): Promise<boolean | null> {
  try {
    const snap = await getDocsFromServer(query(sessionsRef(db, uid, childId), where('slotId', '==', slotId), limit(1)));
    return !snap.empty;
  } catch {
    return null;
  }
}
