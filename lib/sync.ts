import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseError } from 'firebase/app';

import { db } from '@/lib/firebase';
import { OUTBOX_KEY, decodeOutbox, encodeOutbox, upsertEntry, type PendingSession } from '@/src/data/outbox';
import { writeSession } from '@/src/data/sessions';

/**
 * Durable offline save for brushing sessions. Firestore's JS SDK can only keep
 * its offline queue in memory on React Native (no IndexedDB), so a session
 * written offline would be lost if the app is killed. Each session is put in
 * an AsyncStorage outbox first; Firestore confirming the write removes it, and
 * `flushOutbox` retries leftovers on launch and on return to the foreground.
 */

async function readOutbox(): Promise<PendingSession[]> {
  try {
    return decodeOutbox(await AsyncStorage.getItem(OUTBOX_KEY));
  } catch {
    return [];
  }
}

// Serialize read-modify-write so concurrent saves/flushes can't drop an entry.
let queue: Promise<void> = Promise.resolve();
function mutateOutbox(change: (entries: PendingSession[]) => PendingSession[]): Promise<void> {
  queue = queue.then(async () => {
    try {
      const next = change(await readOutbox());
      if (next.length === 0) await AsyncStorage.removeItem(OUTBOX_KEY);
      else await AsyncStorage.setItem(OUTBOX_KEY, encodeOutbox(next));
    } catch {
      // Storage full/unavailable: the Firestore write still goes ahead.
    }
  });
  return queue;
}

const inFlight = new Set<string>();

/** Resolves true when the server confirmed; offline it stays pending until reconnect. */
async function send(entry: PendingSession): Promise<boolean> {
  inFlight.add(entry.id);
  try {
    await writeSession(db, entry.uid, entry.childId, {
      id: entry.id,
      slotId: entry.slotId,
      date: entry.date,
      startedAt: new Date(entry.startedAt),
      durationSec: entry.durationSec,
      completed: entry.completed,
    });
    await mutateOutbox((es) => es.filter((e) => e.id !== entry.id));
    return true;
  } catch (error) {
    // Refused by the rules: the child was deleted (possibly on another device).
    // Retrying can never succeed, so drop it instead of keeping it forever.
    if (error instanceof FirebaseError && error.code === 'permission-denied') {
      await mutateOutbox((es) => es.filter((e) => e.id !== entry.id));
    }
    return false;
  } finally {
    inFlight.delete(entry.id);
  }
}

/**
 * Persist a finished session. Idempotent in `entry.id`; never throws. Offline
 * the promise stays pending, so callers must not make the child wait on it.
 */
export async function saveSession(entry: PendingSession): Promise<boolean> {
  await mutateOutbox((es) => upsertEntry(es, entry));
  return send(entry);
}

/** Retry this parent's unconfirmed sessions (other accounts' entries wait for them). */
export async function flushOutbox(uid: string): Promise<void> {
  for (const entry of await readOutbox()) {
    if (entry.uid === uid && !inFlight.has(entry.id)) void send(entry);
  }
}

/** Drop queued sessions of a deleted child — a retry would recreate docs under it. */
export const dropOutboxForChild = (childId: string) => mutateOutbox((es) => es.filter((e) => e.childId !== childId));

/** Drop everything queued for an account being deleted. */
export const dropOutboxForUser = (uid: string) => mutateOutbox((es) => es.filter((e) => e.uid !== uid));
