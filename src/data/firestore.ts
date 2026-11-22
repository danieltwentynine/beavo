import {
  Timestamp,
  getDocFromServer,
  getDocsFromServer,
  writeBatch,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type FirestoreError,
  type QuerySnapshot,
  type WriteBatch,
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
 * Steps that need the server (delete, import, export) check it first with
 * `requireServer` and bound every wait with `withTimeout`.
 *
 * Listener contract: every `watch*` takes an optional `onError`. A failed
 * listener has stopped for good; the caller marks its data stale and
 * re-subscribes (hooks/useChildDataSync.ts, hooks/useChildWatch.ts).
 */
export type WatchErrorHandler = (error: FirestoreError) => void;

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

/** Receives every write the app fired without waiting for and that was then refused or failed. */
export type BackgroundErrorHandler = (error: unknown) => void;

let backgroundErrorHandler: BackgroundErrorHandler = () => undefined;

/** Set once at startup (lib/errors.ts): routes refused background writes to the parent-facing error store. */
export function setBackgroundErrorHandler(handler: BackgroundErrorHandler): void {
  backgroundErrorHandler = handler;
}

/**
 * Fire a write without waiting for the server. A rejected write is rolled back
 * in the local cache (listeners re-emit without it) and reported to `onError`,
 * else to the app-wide handler, so a refusal is never silent.
 */
export function background(write: Promise<unknown>, onError?: BackgroundErrorHandler): void {
  write.catch((error: unknown) => (onError ?? backgroundErrorHandler)(error));
}

/** A step that needs the server did not answer in time (offline or very slow). */
export class ServerTimeoutError extends Error {
  readonly code = 'deadline-exceeded';
  /** Which step gave up: 'connection check' means nothing was written yet. */
  readonly step: string;
  constructor(step: string) {
    super(`No answer from the server: ${step}`);
    this.step = step;
    this.name = 'ServerTimeoutError';
  }
}

/** How long a "needs a connection" step may wait for the server before it gives up. */
export const SERVER_TIMEOUT_MS = 15_000;

/**
 * Await `promise`, or reject with ServerTimeoutError after `ms`. Offline,
 * Firestore never rejects a queued write, so delete/import would otherwise wait
 * forever. A timed-out write may still land later; every caller is idempotent
 * on retry.
 */
export function withTimeout<T>(promise: Promise<T>, step: string, ms: number = SERVER_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ServerTimeoutError(step)), ms);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

/**
 * Fail fast when the server can't be reached: one server read of `ref`.
 * Call before any multi-step write that must not half-run offline.
 */
export async function requireServer(ref: DocumentReference, ms: number = SERVER_TIMEOUT_MS): Promise<void> {
  await withTimeout(getDocFromServer(ref), 'connection check', ms);
}

const BATCH_LIMIT = 450; // Firestore caps a batch at 500 writes.

/** Commit `ops` in batches of at most BATCH_LIMIT, each awaited (bounded by `ms`). Returns how many ran. */
export async function commitInBatches(
  db: Firestore,
  ops: readonly ((batch: WriteBatch) => void)[],
  ms: number = SERVER_TIMEOUT_MS,
): Promise<number> {
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + BATCH_LIMIT)) op(batch);
    await withTimeout(batch.commit(), 'batched write', ms);
  }
  return ops.length;
}

/**
 * Delete every doc in a collection. Lists from the SERVER, so a cold offline
 * cache can't make us miss docs; throws when offline (or after `ms`). Firestore
 * never cascades deletes, so callers delete subcollections explicitly with this.
 */
export async function deleteCollection(db: Firestore, ref: CollectionReference, ms: number = SERVER_TIMEOUT_MS): Promise<number> {
  const snap = await withTimeout(getDocsFromServer(ref), 'list documents', ms);
  return commitInBatches(db, snap.docs.map((d) => (batch: WriteBatch) => batch.delete(d.ref)), ms);
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
