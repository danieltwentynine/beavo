/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  PENDING_OPS_KEY,
  accountOp,
  classifyOpError,
  createOpCoordinator,
  decodeOps,
  encodeOps,
  opsFor,
  withOp,
  withoutOp,
  endSessionFor,
  type OpDeps,
  type PendingOp,
} from './pendingOps.ts';

const child: PendingOp = { kind: 'deleteChild', uid: 'a', childId: 'c1' };

/** An in-memory AsyncStorage that can be told to fail. Survives "restarts" (new coordinators). */
function fakeStorage(initial: PendingOp[] = []) {
  const data = new Map<string, string>(initial.length ? [[PENDING_OPS_KEY, encodeOps(initial)]] : []);
  const fail = { read: false, write: false };
  return {
    data,
    fail,
    stored: () => decodeOps(data.get(PENDING_OPS_KEY) ?? null),
    getItem: async (key: string) => {
      if (fail.read) throw new Error('storage unavailable');
      return data.get(key) ?? null;
    },
    setItem: async (key: string, value: string) => {
      if (fail.write) throw new Error('storage full');
      data.set(key, value);
    },
    removeItem: async (key: string) => {
      if (fail.write) throw new Error('storage full');
      data.delete(key);
    },
  };
}

const firebaseError = (code: string) => Object.assign(new Error(code), { code });

/** A fake world: who is signed in, what Firestore/Auth do, and everything that was called. */
function world(storage = fakeStorage()) {
  const calls = {
    erase: 0,
    erasedIds: [] as string[][],
    deleteChild: 0,
    authDelete: 0,
    teardown: [] as string[],
    endSession: [] as string[],
    screenResets: [] as (string | null)[],
    notices: [] as string[],
    retries: 0,
  };
  const state = {
    owner: 'a' as string | null,
    /** The phone's Google session (endSession signs it out). */
    googleSignedIn: true,
    /** Pending while the native Google sign-out runs. */
    signOutGate: null as Promise<void> | null,
    /** In-memory child store (whoever is on screen). */
    childStore: ['a-child'] as string[],
    /** Runs right after the Auth user was deleted (e.g. another parent signs in at once). */
    afterAuthDelete: (): void => undefined,
    authFailures: [] as string[],
    eraseFailures: [] as string[],
    /** Runs right after the Firestore step (e.g. another account signs in). */
    afterErase: (): void => undefined,
    eraseGate: null as Promise<void> | null,
  };
  const deps: OpDeps = {
    storage,
    currentOwner: () => state.owner,
    deleteChildData: async () => {
      calls.deleteChild++;
    },
    eraseAccountData: async (_uid, ids) => {
      calls.erase++;
      calls.erasedIds.push([...ids]);
      if (state.eraseGate) await state.eraseGate;
      const failure = state.eraseFailures.shift();
      if (failure) throw firebaseError(failure);
      state.afterErase();
    },
    deleteAuthUser: async (uid) => {
      if (state.owner !== uid) return false;
      const failure = state.authFailures.shift();
      if (failure) throw firebaseError(failure);
      calls.authDelete++;
      state.owner = null;
      state.afterAuthDelete();
      return true;
    },
    cleanupAccountData: async (uid) => {
      calls.teardown.push(uid);
    },
    endSession: (uid) =>
      endSessionFor(uid, {
        currentOwner: () => state.owner,
        signOutProvider: async () => {
          calls.endSession.push(uid);
          if (state.signOutGate) await state.signOutGate;
          state.googleSignedIn = false;
        },
        resetScreens: () => {
          calls.screenResets.push(state.owner);
          state.childStore = [];
        },
      }),
    errorCode: (error) => (error as { code?: string }).code,
    notify: (key) => {
      calls.notices.push(key);
    },
    scheduleRetry: () => {
      calls.retries++;
    },
  };
  return { deps, calls, state, storage };
}

// ---- 1. A transient Auth failure never discards a started erasure ----

test('Firestore erased, Auth fails once (network) → kept at phase auth; after a restart it completes', async () => {
  const w = world();
  w.state.authFailures = ['auth/network-request-failed'];
  const first = createOpCoordinator(w.deps);
  assert.equal(await first.run(accountOp('a', ['c1'])).result, 'retrying');
  assert.equal(w.calls.erase, 1);
  assert.equal(w.calls.retries, 1);
  assert.deepEqual(w.storage.stored(), [{ ...accountOp('a', ['c1']), phase: 'auth' }]);
  assert.deepEqual(w.calls.teardown, []);

  const afterRestart = createOpCoordinator(w.deps); // new process, same storage
  await afterRestart.reconcile('a');
  assert.equal(w.calls.erase, 1, 'phase auth: Firestore is not erased again');
  assert.equal(w.calls.authDelete, 1);
  assert.deepEqual(w.storage.stored(), []);
  assert.deepEqual(w.calls.teardown, ['a']);
  assert.deepEqual(w.calls.notices, ['notice.finished']);
});

test('transient codes retry; sign-in codes wait for a sign-in; neither drops the erasure', async () => {
  for (const code of ['auth/network-request-failed', 'auth/timeout', 'auth/too-many-requests', 'auth/internal-error', 'unavailable', 'deadline-exceeded']) {
    assert.equal(classifyOpError(code), 'retry', code);
  }
  assert.equal(classifyOpError('auth/requires-recent-login'), 'signIn');
  assert.equal(classifyOpError('permission-denied'), 'refused');
  assert.equal(classifyOpError(undefined), 'refused');

  const w = world();
  w.state.authFailures = ['auth/requires-recent-login'];
  assert.equal(await createOpCoordinator(w.deps).run(accountOp('a', [])).result, 'signInNeeded');
  assert.equal(w.storage.stored().length, 1);
  assert.deepEqual(w.calls.teardown, []);
});

test('a refused step never drops a started account erasure; a refused child deletion is dropped', async () => {
  const w = world();
  w.state.eraseFailures = ['permission-denied'];
  const ops = createOpCoordinator(w.deps);
  assert.equal(await ops.run(accountOp('a', [])).result, 'refused');
  assert.equal(w.storage.stored().length, 1, 'erasure kept');
  assert.deepEqual(w.calls.teardown, []);

  const c = world();
  c.deps.deleteChildData = async () => {
    throw firebaseError('permission-denied');
  };
  assert.equal(await createOpCoordinator(c.deps).run(child).result, 'refused');
  assert.deepEqual(c.storage.stored(), []);
});

// ---- 2. Storage failures: unavailable is not empty; persist before destroying ----

test('queue unreadable: nothing destructive starts and existing entries are not overwritten', async () => {
  const storage = fakeStorage([child]);
  const before = storage.data.get(PENDING_OPS_KEY);
  storage.fail.read = true;
  const w = world(storage);
  assert.equal(await createOpCoordinator(w.deps).run(accountOp('a', ['c1'])).result, 'notPersisted');
  assert.equal(w.calls.erase, 0);
  assert.equal(storage.data.get(PENDING_OPS_KEY), before);
  storage.fail.read = false;
  assert.deepEqual(storage.stored(), [child]);
});

test('queue unwritable: the retry record is not saved, so the destructive step never starts', async () => {
  const storage = fakeStorage();
  storage.fail.write = true;
  const w = world(storage);
  assert.equal(await createOpCoordinator(w.deps).run(accountOp('a', [])).result, 'notPersisted');
  assert.equal(await createOpCoordinator(w.deps).run(child).result, 'notPersisted');
  assert.equal(w.calls.erase, 0);
  assert.equal(w.calls.deleteChild, 0);
});

test('reconcile with unreadable storage runs nothing and writes nothing', async () => {
  const storage = fakeStorage([accountOp('a', [])]);
  storage.fail.read = true;
  const w = world(storage);
  await createOpCoordinator(w.deps).reconcile('a');
  assert.equal(w.calls.erase, 0);
  storage.fail.read = false;
  assert.equal(storage.stored().length, 1);
});

// ---- 3. Account switches and overlapping retries ----

test('account switch between Firestore erasure and Auth deletion: paused, kept, no teardown, no message', async () => {
  const w = world();
  w.state.afterErase = () => {
    w.state.owner = 'b'; // another parent signs in on this phone
  };
  const ops = createOpCoordinator(w.deps);
  assert.equal(await ops.run(accountOp('a', [])).result, 'paused');
  assert.equal(w.calls.authDelete, 0);
  assert.deepEqual(w.calls.teardown, []);
  assert.deepEqual(w.calls.notices, []);
  assert.deepEqual(w.storage.stored(), [{ ...accountOp('a', []), phase: 'auth' }]);

  await ops.reconcile('b'); // b's launch/foreground: a's erasure is not b's to run
  assert.equal(w.calls.authDelete, 0);
  assert.deepEqual(w.calls.teardown, []);

  w.state.owner = 'a'; // the owner signs in again
  w.state.afterErase = () => undefined;
  await ops.reconcile('a');
  assert.equal(w.calls.authDelete, 1);
  assert.deepEqual(w.calls.teardown, ['a']);
  assert.deepEqual(w.calls.notices, ['notice.finished']);
});

test("another account signed in before anything was saved: notStarted — nothing stored, nothing done", async () => {
  const w = world();
  w.state.owner = 'b';
  assert.equal(await createOpCoordinator(w.deps).run(accountOp('a', [])).result, 'notStarted');
  assert.equal(w.calls.erase, 0);
  assert.deepEqual(w.storage.stored(), [], 'no retry is promised for something never saved');
});

test('a stored erasure is left untouched (not run) while another account is signed in', async () => {
  const w = world(fakeStorage([accountOp('a', [])]));
  w.state.owner = 'b';
  assert.equal(await createOpCoordinator(w.deps).run(accountOp('a', [])).result, 'notStarted');
  assert.equal(w.calls.erase, 0);
  assert.equal(w.storage.stored().length, 1);
});

test("switch to B between A's Auth deletion and teardown: B stays signed in (Firebase and Google), A's op completes", async () => {
  const w = world();
  w.state.afterAuthDelete = () => {
    w.state.owner = 'b'; // parent B signs in on this phone right away
  };
  const ops = createOpCoordinator(w.deps);
  const { result } = ops.run(accountOp('a', ['c1']));
  assert.equal(await result, 'doneQuietly');
  assert.equal(w.calls.authDelete, 1);
  assert.deepEqual(w.storage.stored(), [], "A's op is complete and removed");
  assert.deepEqual(w.calls.teardown, ['a'], "only A's own local data is cleaned");
  assert.deepEqual(w.calls.endSession, [], 'no Google sign-out, no screen reset');
  assert.equal(w.state.owner, 'b');
  assert.equal(w.state.googleSignedIn, true);
  assert.deepEqual(w.calls.notices, [], "no 'finished' message in B's session");
});

test("B signs in while A's Google sign-out is pending: B's child store is untouched, no completion message", async () => {
  const w = world();
  let finishSignOut: () => void = () => undefined;
  w.state.signOutGate = new Promise<void>((resolve) => {
    finishSignOut = resolve;
  });
  const { result } = createOpCoordinator(w.deps).run(accountOp('a', []));
  // Wait until the native sign-out is in flight, then B signs in and loads B's children.
  while (w.calls.endSession.length === 0) await new Promise((resolve) => setTimeout(resolve, 1));
  w.state.owner = 'b';
  w.state.childStore = ['b-child-1', 'b-child-2'];
  finishSignOut();
  assert.equal(await result, 'doneQuietly');
  assert.deepEqual(w.state.childStore, ['b-child-1', 'b-child-2'], "B's in-memory child state survives");
  assert.deepEqual(w.calls.screenResets, [], 'no reset ran');
  assert.deepEqual(w.calls.notices, []);
  assert.deepEqual(w.storage.stored(), [], "A's op is complete");
});

test('endSessionFor re-checks before and after the await, immediately before the reset', async () => {
  const log: string[] = [];
  let owner: string | null = 'b';
  const teardown = {
    currentOwner: () => owner,
    signOutProvider: async () => {
      log.push('signOut');
    },
    resetScreens: () => {
      log.push('reset');
    },
  };
  assert.equal(await endSessionFor('a', teardown), false, 'B already signed in: nothing at all');
  assert.deepEqual(log, []);
  owner = null;
  assert.equal(await endSessionFor('a', teardown), true);
  assert.deepEqual(log, ['signOut', 'reset']);
});

test('after the Auth deletion with nobody signed in, the session is ended (Google sign-out)', async () => {
  const w = world();
  assert.equal(await createOpCoordinator(w.deps).run(accountOp('a', [])).result, 'done');
  assert.deepEqual(w.calls.endSession, ['a']);
  assert.equal(w.state.googleSignedIn, false);
  assert.deepEqual(w.state.childStore, [], 'screens reset for the deleted account');
});

test('overlapping launch + foreground + timer + screen runs execute the operation once and report once', async () => {
  let release: () => void = () => undefined;
  const w = world(fakeStorage([accountOp('a', ['c1'])]));
  w.state.eraseGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ops = createOpCoordinator(w.deps);
  const launch = ops.reconcile('a');
  const foreground = ops.reconcile('a');
  const timer = ops.reconcile('a');
  await new Promise((resolve) => setTimeout(resolve, 10));
  const screen = ops.run(accountOp('a', ['c1']));
  assert.equal(screen.started, false, 'the screen joins the run already going');
  release();
  await Promise.all([launch, foreground, timer, screen.result]);
  assert.equal(w.calls.erase, 1);
  assert.equal(w.calls.authDelete, 1);
  assert.deepEqual(w.calls.teardown, ['a']);
  assert.equal(w.calls.notices.length, 1);
});

// ---- 4. No child id is ever dropped ----

const ids = (n: number) => Array.from({ length: n }, (_, i) => `child${i}`);

test('codec boundary: 50, 51, 10,000, 10,001 and 50,000 child ids all survive a round trip', () => {
  for (const n of [50, 51, 10_000, 10_001, 50_000]) {
    const op = accountOp('a', ids(n));
    assert.equal(op.childIds.length, n, `producer keeps all ${n}`);
    const back = decodeOps(encodeOps([op]));
    assert.equal(back.length, 1, `${n} ids`);
    assert.deepEqual(back[0].kind === 'deleteAccount' ? back[0].childIds : [], op.childIds);
  }
});

test('10,001 ids: all are persisted before the erasure, and the erasure receives every one', async () => {
  const w = world();
  w.state.authFailures = ['auth/network-request-failed']; // stop after Firestore to inspect what was stored
  const op = accountOp('a', ids(10_001));
  assert.equal(await createOpCoordinator(w.deps).run(op).result, 'retrying');
  assert.equal(w.calls.erasedIds[0].length, 10_001);
  const stored = w.storage.stored()[0];
  assert.equal(stored.kind === 'deleteAccount' ? stored.childIds.length : -1, 10_001);
});

test('if the full id list cannot be saved, nothing starts (no partial list, no erasure)', async () => {
  const storage = fakeStorage();
  storage.fail.write = true;
  const w = world(storage);
  assert.equal(await createOpCoordinator(w.deps).run(accountOp('a', ids(10_001))).result, 'notPersisted');
  assert.equal(w.calls.erase, 0);
  assert.deepEqual(storage.stored(), []);
});

test('the producer only dedupes and drops empty ids — it never truncates', () => {
  const op = accountOp('a', [...ids(10_001), 'child1', '']);
  assert.equal(op.childIds.length, 10_001);
});

// ---- Queue helpers ----

test("an operation is remembered once; an account erasure covers that owner's child deletions", () => {
  const account = accountOp('a', ['c1']);
  const other: PendingOp = { kind: 'deleteChild', uid: 'b', childId: 'x' };
  assert.equal(withOp(withOp([], child), child).length, 1);
  assert.deepEqual(withoutOp([child, account], child), [account]);
  assert.deepEqual(opsFor([child, account, other], 'a'), [account]);
  assert.deepEqual(opsFor([child, other], 'b'), [other]);
});

test('stored operations are untrusted input; older entries without a phase still load', () => {
  assert.deepEqual(decodeOps('{oops'), []);
  assert.deepEqual(decodeOps(JSON.stringify([child, { kind: 'dropTables' }, { kind: 'deleteChild', uid: '' }])), [child]);
  assert.equal(decodeOps(JSON.stringify([{ kind: 'deleteAccount', uid: 'a', childIds: [] }])).length, 1);
  assert.deepEqual(decodeOps(null), []);
});
