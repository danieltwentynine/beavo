import {
  Timestamp,
  getDocsFromServer,
  writeBatch,
  type CollectionReference,
  type DocumentData,
  type Firestore,
  type QuerySnapshot,
} from 'firebase/firestore';
import { z } from 'zod';

/**
 * Shared repository helpers. Everything in src/data takes the Firestore
 * instance as its first argument so the emulator tests can pass their own;
 * the app passes `db` from lib/firebase.ts.
 *
 * Offline contract: write functions resolve when the SERVER confirms. Offline
 * that never happens (the SDK queues the write and syncs it on reconnect), so
 * screens must not await writes — they fire them with `background()` and read
 * state back through the `watch*` listeners, which show local writes at once.
 */

/** Firestore Timestamp → Date. Missing/null → undefined. */
export const date = z.custom<Timestamp>((v) => v instanceof Timestamp).transform((t) => t.toDate());
export const optionalDate = date.nullish().transform((d) => d ?? undefined);

/** Validated docs of a snapshot; malformed ones are skipped, never crash a screen. */
export function parseDocs<T extends z.ZodType>(snap: QuerySnapshot, schema: T): (z.output<T> & { id: string })[] {
  return snap.docs.flatMap((d) => {
    const parsed = schema.safeParse(d.data());
    return parsed.success ? [{ ...(parsed.data as object), id: d.id } as z.output<T> & { id: string }] : [];
  });
}

/** Fire a write without waiting for the server; a rejected write is rolled back in the local cache. */
export function background(write: Promise<unknown>): void {
  write.catch(() => {
    // Listeners re-emit without the rejected change; nothing else to undo.
  });
}

const BATCH_LIMIT = 450; // Firestore caps a batch at 500 writes.

/**
 * Delete every doc in a collection. Lists from the SERVER, so a cold offline
 * cache can't make us miss docs; throws when offline. Firestore never cascades
 * deletes, so callers delete subcollections explicitly with this.
 */
export async function deleteCollection(db: Firestore, ref: CollectionReference): Promise<number> {
  const snap = await getDocsFromServer(ref);
  for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const d of snap.docs.slice(i, i + BATCH_LIMIT)) batch.delete(d.ref);
    await batch.commit();
  }
  return snap.size;
}

/** Firestore doc data → plain JSON (Timestamps as ISO strings), for the data export. */
export function toPlain(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(toPlain);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as DocumentData).map(([k, v]) => [k, toPlain(v)]));
  }
  return value;
}
