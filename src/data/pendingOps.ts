import { z } from 'zod';

import type { StringKey } from '@/lib/i18n';

/**
 * Operations that need the server and must finish once started (delete a
 * child, erase an account). Pure — storage, Firebase and notices are injected
 * — so node --test can drive restarts, storage failures, account switches and
 * overlapping retries; lib/account.ts wires the real dependencies.
 *
 * Why: a timeout ends the wait but cannot cancel a write Firestore already
 * queued, and an account erasure that has started (erasure marker written)
 * can't be undone. So the operation is persisted BEFORE its destructive step,
 * re-run (each step is idempotent) on launch, foreground and a retry timer,
 * and the parent is told the real outcome. Only ids are stored, never names.
 *
 * Invariants:
 * - Persist first: if the queue can't be read or written, nothing destructive starts.
 * - A storage read failure is "unavailable", never "empty": nothing is overwritten.
 * - An account erasure is never dropped on an error once started; only completion removes it.
 * - It runs only for its own owner: on an account switch it pauses (kept, no teardown, no message).
 * - After the Auth user A is deleted, only A's own local data is cleaned; the session-wide
 *   part (Google sign-out, screen reset, the "finished" message) runs only if nobody or A
 *   is signed in — never against another parent who signed in meanwhile.
 * - Every child id is persisted (no cap); if that write fails, nothing starts.
 * - One run per operation at a time, whoever asks (launch, foreground, timer, the screen).
 */
export const PENDING_OPS_KEY = 'beavo.pendingOps.v1';

const opSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('deleteChild'), uid: z.string().min(1), childId: z.string().min(1) }),
  z.object({
    kind: z.literal('deleteAccount'),
    uid: z.string().min(1),
    // No cap: every known id is kept (a cap would silently lose the cleanup of an
    // omitted child). The whole list is persisted before the erasure starts.
    childIds: z.array(z.string().min(1)),
    /** 'auth': the Firestore erasure is done, only the Auth user is left. Missing on older entries = 'firestore'. */
    phase: z.enum(['firestore', 'auth']).optional(),
  }),
]);

export type PendingOp = z.infer<typeof opSchema>;
type AccountOp = Extract<PendingOp, { kind: 'deleteAccount' }>;

/** The account-erasure operation for `uid`, with every known child id (deduplicated; none dropped). */
export function accountOp(uid: string, childIds: readonly string[]): AccountOp {
  return { kind: 'deleteAccount', uid, childIds: [...new Set(childIds.filter((id) => id.length > 0))], phase: 'firestore' };
}

export const opKey = (op: PendingOp): string => (op.kind === 'deleteChild' ? `deleteChild/${op.uid}/${op.childId}` : `deleteAccount/${op.uid}`);

/** Storage is untrusted: bad entries are dropped one by one, bad JSON reads as none. */
export function decodeOps(raw: string | null): PendingOp[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      const op = opSchema.safeParse(item);
      return op.success ? [op.data] : [];
    });
  } catch {
    return [];
  }
}

export const encodeOps = (ops: readonly PendingOp[]): string => JSON.stringify(ops);

/** Add or replace (same operation on the same target is kept once). */
export const withOp = (ops: readonly PendingOp[], op: PendingOp): PendingOp[] => [...ops.filter((o) => opKey(o) !== opKey(op)), op];

export const withoutOp = (ops: readonly PendingOp[], op: PendingOp): PendingOp[] => ops.filter((o) => opKey(o) !== opKey(op));

/** This owner's operations; an account deletion makes its own child deletions redundant (it covers them). */
export function opsFor(ops: readonly PendingOp[], uid: string): PendingOp[] {
  const mine = ops.filter((o) => o.uid === uid);
  return mine.some((o) => o.kind === 'deleteAccount') ? mine.filter((o) => o.kind === 'deleteAccount') : mine;
}

// ---- Error classes ----

/** retry: transient (offline, timeout, network, throttled) · signIn: Auth needs a fresh sign-in · refused: won't succeed as is. */
export type OpErrorKind = 'retry' | 'signIn' | 'refused';

const RETRYABLE_CODES = new Set([
  // Firestore, and our own timeout (ServerTimeoutError.code)
  'unavailable',
  'deadline-exceeded',
  'aborted',
  'resource-exhausted',
  'internal',
  // Firebase Auth
  'auth/network-request-failed',
  'auth/timeout',
  'auth/too-many-requests',
  'auth/internal-error',
  'auth/quota-exceeded',
]);
const SIGN_IN_CODES = new Set(['auth/requires-recent-login', 'auth/user-token-expired', 'auth/invalid-user-token', 'auth/user-mismatch']);

export function classifyOpError(code: string | undefined): OpErrorKind {
  if (code && RETRYABLE_CODES.has(code)) return 'retry';
  if (code && SIGN_IN_CODES.has(code)) return 'signIn';
  return 'refused';
}

// ---- Coordinator ----

export interface OpStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export interface OpDeps {
  storage: OpStorage;
  /** The signed-in Firebase uid right now (null when signed out). */
  currentOwner: () => string | null;
  /** Firestore part of a child deletion (idempotent), plus its local outbox entries. */
  deleteChildData: (uid: string, childId: string) => Promise<void>;
  /** Firestore part of an account erasure (idempotent; writes the erasure marker first). */
  eraseAccountData: (uid: string, childIds: readonly string[]) => Promise<void>;
  /** Delete the Auth user `uid`; false when that user is not the one signed in (nothing done). */
  deleteAuthUser: (uid: string) => Promise<boolean>;
  /** Local data keyed to the deleted account `uid` only (snapshot, consent record, outbox). Never touches another account. */
  cleanupAccountData: (uid: string) => Promise<void>;
  /**
   * Session-wide teardown after `uid` was deleted (Google sign-out, screen state), via
   * `endSessionFor`. True when it ran to the end for `uid`; false when another parent
   * was signed in at any check — then nothing session-wide was reset after that point.
   */
  endSession: (uid: string) => Promise<boolean>;
  /** Error code for classification (Firebase code; 'deadline-exceeded' for our timeout). */
  errorCode: (error: unknown) => string | undefined;
  notify: (key: StringKey, tone: 'error' | 'info') => void;
  scheduleRetry: () => void;
}

/**
 * done: finished (removed) · doneQuietly: finished while another parent is signed
 * in — their session and screens are left alone, no message · retrying: transient
 * failure, kept, retry scheduled · paused: another account signed in after the op
 * was saved — kept untouched · notStarted: another account was signed in before
 * anything was saved — nothing stored, nothing done · signInNeeded: kept until the
 * owner signs in again · refused: a child deletion that can't succeed (removed) or
 * an account erasure that failed (kept) · notPersisted: the queue couldn't be
 * saved, so nothing destructive was started.
 */
export type RunResult = 'done' | 'doneQuietly' | 'retrying' | 'paused' | 'notStarted' | 'signInNeeded' | 'refused' | 'notPersisted';

type ReadResult = { ok: true; ops: PendingOp[] } | { ok: false };

export function createOpCoordinator(deps: OpDeps) {
  let storageChain: Promise<unknown> = Promise.resolve();
  const inFlight = new Map<string, Promise<RunResult>>();
  const reconciling = new Map<string, Promise<void>>();

  /** Queue storage access so read-modify-writes never interleave. */
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const next = storageChain.then(task, task);
    storageChain = next.catch(() => undefined);
    return next;
  };

  async function readRaw(): Promise<ReadResult> {
    try {
      return { ok: true, ops: decodeOps(await deps.storage.getItem(PENDING_OPS_KEY)) };
    } catch {
      return { ok: false };
    }
  }

  /** The queue as stored; `ok: false` when storage can't be read (never treated as empty). */
  const read = (): Promise<ReadResult> => serial(readRaw);

  /** Read-modify-write. False when the read or the write failed; a failed read never writes. */
  const mutate = (change: (ops: PendingOp[]) => PendingOp[]): Promise<boolean> =>
    serial(async () => {
      const current = await readRaw();
      if (!current.ok) return false;
      try {
        const next = change(current.ops);
        if (next.length === 0) await deps.storage.removeItem(PENDING_OPS_KEY);
        else await deps.storage.setItem(PENDING_OPS_KEY, encodeOps(next));
        return true;
      } catch {
        return false;
      }
    });

  async function execute(op: PendingOp): Promise<RunResult> {
    // Not this owner's session: nothing is saved or done (a stored op simply stays stored).
    if (deps.currentOwner() !== op.uid) return 'notStarted';
    // Persist BEFORE the destructive step: no retry record, no start.
    if (!(await mutate((ops) => withOp(ops, op)))) return 'notPersisted';
    try {
      if (op.kind === 'deleteChild') {
        await deps.deleteChildData(op.uid, op.childId);
      } else {
        if (op.phase !== 'auth') {
          await deps.eraseAccountData(op.uid, op.childIds);
          // Best effort: if this write fails the entry stays at 'firestore' and the idempotent erasure simply runs again.
          await mutate((ops) => withOp(ops, { ...op, phase: 'auth' }));
        }
        // The owner may have changed while Firestore was erased: never delete or tear down someone else.
        if (deps.currentOwner() !== op.uid) return 'paused';
        if (!(await deps.deleteAuthUser(op.uid))) return 'paused';
      }
    } catch (error) {
      const kind = classifyOpError(deps.errorCode(error));
      if (kind === 'retry') {
        deps.scheduleRetry();
        return 'retrying';
      }
      if (kind === 'signIn') return 'signInNeeded';
      // An erasure that started is never dropped: it stays queued for the next run.
      if (op.kind === 'deleteChild') await mutate((ops) => withoutOp(ops, op));
      return 'refused';
    }
    await mutate((ops) => withoutOp(ops, op));
    if (op.kind === 'deleteChild') return 'done';
    // The Auth user `op.uid` was verified and deleted: its own local data goes.
    await deps.cleanupAccountData(op.uid);
    // Session-wide teardown only if nobody (or the deleted account) is signed in now:
    // another parent who signed in meanwhile keeps their Firebase and Google session.
    const owner = deps.currentOwner();
    if (owner !== null && owner !== op.uid) return 'doneQuietly';
    // endSession re-checks after every await: B signing in mid-teardown also ends quietly.
    return (await deps.endSession(op.uid)) ? 'done' : 'doneQuietly';
  }

  /** Run `op` once; a call while it already runs joins that run (`started: false`). */
  function run(op: PendingOp): { result: Promise<RunResult>; started: boolean } {
    const key = opKey(op);
    const running = inFlight.get(key);
    if (running) return { result: running, started: false };
    const result = execute(op).finally(() => inFlight.delete(key));
    inFlight.set(key, result);
    return { result, started: true };
  }

  const MESSAGES: Partial<Record<RunResult, { key: StringKey; tone: 'error' | 'info' }>> = {
    done: { key: 'notice.finished', tone: 'info' },
    signInNeeded: { key: 'notice.signInToFinish', tone: 'error' },
    refused: { key: 'notice.notSaved', tone: 'error' },
  };

  /**
   * Finish `uid`'s stored operations (launch, foreground, timer — all share one
   * run per operation). Messages come only from the run that actually executed;
   * paused and retrying operations stay quiet. Unreadable storage: nothing runs.
   */
  function reconcile(uid: string): Promise<void> {
    const existing = reconciling.get(uid);
    if (existing) return existing;
    const job = (async () => {
      const stored = await read();
      if (!stored.ok) return;
      for (const op of opsFor(stored.ops, uid)) {
        const { result, started } = run(op);
        const outcome = await result;
        const message = started ? MESSAGES[outcome] : undefined;
        if (message) deps.notify(message.key, message.tone);
      }
    })().finally(() => reconciling.delete(uid));
    reconciling.set(uid, job);
    return job;
  }

  return { run, reconcile, read };
}

export type OpCoordinator = ReturnType<typeof createOpCoordinator>;

// ---- Session-wide teardown that can't hit the next parent ----

export interface SessionTeardown {
  /** The signed-in Firebase uid right now (null when signed out). */
  currentOwner: () => string | null;
  /** Provider sign-out (Google): async, native, global to the phone. */
  signOutProvider: () => Promise<void>;
  /** Reset in-memory screen state (child store). Synchronous. */
  resetScreens: () => void;
}

/**
 * End the session of the deleted account `uid`. The owner is re-checked before
 * each step and after every await, immediately before each reset: if another
 * parent (B) is signed in at any check — e.g. B signed in while the native Google
 * sign-out was pending — it stops there and B's state is left untouched.
 * Returns true only when it ran to the end for `uid`.
 */
export async function endSessionFor(uid: string, teardown: SessionTeardown): Promise<boolean> {
  const stillOurs = () => {
    const owner = teardown.currentOwner();
    return owner === null || owner === uid;
  };
  if (!stillOurs()) return false;
  await teardown.signOutProvider();
  if (!stillOurs()) return false; // B arrived during the await: no reset, no completion message
  teardown.resetScreens();
  return true;
}
