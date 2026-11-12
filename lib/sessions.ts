import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Timestamp,
  collection,
  doc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { z } from 'zod';

import type { ToothZone } from '@/types';
import { db, timestampToDate } from '@/lib/firebase';
import { LOCAL_UID } from '@/lib/localData';
import { addLocalSession, readLocalSessions } from '@/lib/localStore';
import { OUTBOX_KEY, decodeOutbox, encodeOutbox, type PendingSession } from '@/lib/outbox';

export interface SavedSessionInput {
  id: string;
  childId: string;
  parentUid: string;
  /** When brushing actually finished — captured at finish, so a later retry
   *  files the session under the day it happened, not the day it was saved. */
  completedAt: Date;
  durationSeconds: number;
  zonesDetected: ToothZone[];
  zonesCoverage: Record<string, number>;
  score: number;
  coachMessage: string;
  streak: number;
}

export interface RecentSession {
  id: string;
  score: number;
  completedAt: Date;
}

const sessionDocSchema = z.object({
  score: z.number(),
  completedAt: timestampToDate.optional(),
});

/** Reserve an id up front so a retry overwrites the same doc instead of duplicating it. */
export function newSessionId(): string {
  return doc(collection(db, 'sessions')).id;
}

/** The outbox entry is the wire format: one JSON-safe copy of the session doc. */
const toEntry = (input: SavedSessionInput): PendingSession => ({
  ...input,
  completedAt: input.completedAt.toISOString(),
});

async function readOutbox(): Promise<PendingSession[]> {
  try {
    return decodeOutbox(await AsyncStorage.getItem(OUTBOX_KEY));
  } catch {
    return [];
  }
}

// ponytail: read-modify-write with no lock. Entries are keyed by a stable session
// id and the Firestore write is idempotent, so the worst a lost race costs is one
// redundant retry on the next launch. Add a mutex only if writes ever fan out.
async function putEntry(entry: PendingSession): Promise<void> {
  try {
    const others = (await readOutbox()).filter((e) => e.id !== entry.id);
    await AsyncStorage.setItem(OUTBOX_KEY, encodeOutbox([...others, entry]));
  } catch {
    // Storage full or unavailable: the Firestore write still goes ahead.
  }
}

async function dropEntry(id: string): Promise<void> {
  try {
    const others = (await readOutbox()).filter((e) => e.id !== id);
    if (others.length === 0) await AsyncStorage.removeItem(OUTBOX_KEY);
    else await AsyncStorage.setItem(OUTBOX_KEY, encodeOutbox(others));
  } catch {
    // Leftovers are retried on the next launch; nothing is lost by failing here.
  }
}

/** The Firestore session doc for a stored entry — shared with the device → account move. */
export function sessionDoc(entry: PendingSession) {
  const completedAt = new Date(entry.completedAt);
  return {
    childId: entry.childId,
    parentUid: entry.parentUid,
    startedAt: Timestamp.fromDate(new Date(completedAt.getTime() - entry.durationSeconds * 1000)),
    completedAt: Timestamp.fromDate(completedAt),
    durationSeconds: entry.durationSeconds,
    zonesDetected: entry.zonesDetected,
    zonesCoverage: entry.zonesCoverage,
    score: entry.score,
    coachMessage: entry.coachMessage,
    streak: entry.streak,
  };
}

async function writeEntry(entry: PendingSession): Promise<boolean> {
  try {
    await setDoc(doc(db, 'sessions', entry.id), sessionDoc(entry));
    return true;
  } catch {
    return false;
  }
}

/**
 * Persist a finished session — idempotent in `input.id`, never throws to the child UI.
 *
 * The session lands in the on-device outbox *before* the network attempt, so it
 * survives the app being killed while offline. Firestore confirming the write is
 * what removes it. Offline the returned promise stays pending indefinitely (the
 * SDK parks the mutation in an in-memory queue and never rejects), so callers
 * must not make the child wait on it — see `saveLastResult`.
 */
export async function saveSession(input: SavedSessionInput): Promise<boolean> {
  const entry = toEntry(input);
  if (input.parentUid === LOCAL_UID) {
    // Device-only: storage is the destination, so there is nothing to sync.
    try {
      await addLocalSession(entry);
      return true;
    } catch {
      return false;
    }
  }
  await putEntry(entry);
  const ok = await writeEntry(entry);
  if (ok) await dropEntry(entry.id);
  return ok;
}

let flushed = false;

/**
 * Retry sessions a previous run left unconfirmed. Once per launch, and only for
 * the signed-in parent (the security rules reject anyone else's). Sequential on
 * purpose: while offline the first write simply never settles, and the rest wait
 * with it until connectivity returns.
 */
export async function flushOutbox(parentUid: string): Promise<void> {
  if (flushed) return;
  flushed = true;
  for (const entry of await readOutbox()) {
    if (entry.parentUid !== parentUid) continue;
    if (await writeEntry(entry)) await dropEntry(entry.id);
  }
}

// Equality-only query + client-side sort: needs no composite index and includes
// parentUid so the security rules can prove the query only touches this parent's
// sessions. Revisit with an indexed orderBy once history can outgrow the cap.
const FETCH_CAP = 200;

export async function fetchRecentSessions(
  parentUid: string,
  childId: string,
  max = 10,
): Promise<RecentSession[]> {
  try {
    if (parentUid === LOCAL_UID) {
      return (await readLocalSessions())
        .filter((s) => s.childId === childId)
        .map((s) => ({ id: s.id, score: s.score, completedAt: new Date(s.completedAt) }))
        .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
        .slice(0, max);
    }
    const q = query(
      collection(db, 'sessions'),
      where('parentUid', '==', parentUid),
      where('childId', '==', childId),
      limit(FETCH_CAP),
    );
    const snap = await getDocs(q);
    const sessions = snap.docs.flatMap((d) => {
      const parsed = sessionDocSchema.safeParse(d.data());
      if (!parsed.success) return [];
      return [{ id: d.id, score: parsed.data.score, completedAt: parsed.data.completedAt ?? new Date() }];
    });
    sessions.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
    return sessions.slice(0, max);
  } catch {
    return [];
  }
}
