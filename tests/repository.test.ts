/// <reference types="node" />
// Repository layer against the Firestore emulator, with the real rules — run: npm run test:emulator
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';

import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { FirebaseError } from 'firebase/app';
import { collection, deleteDoc, disableNetwork, doc, enableNetwork, getDocFromServer, getDocs, setDoc, updateDoc, waitForPendingWrites, type Firestore } from 'firebase/firestore';

import { deleteAllUserData, exportAllData, fetchUserProfile, importBackup, saveConsent } from '../src/data/account.ts';
import { parseBackup } from '../src/data/backup.ts';
import { childRef, childrenRef, createChild, deleteChild, updateChild, watchChildren } from '../src/data/children.ts';
import { consentAfterWrite, localConsentRecord, planConsentCheck } from '../src/data/consent.ts';
import { ServerTimeoutError, withTimeout } from '../src/data/firestore.ts';
import { localDate, slotsActiveOn } from '../src/data/schedule.ts';
import { hasSessionsForSlot, watchSessionsOn, writeSession } from '../src/data/sessions.ts';
import { addSlot, removeSlot, slotsRef, watchSlots } from '../src/data/slots.ts';
import { addToothEvents, categoriesRef, seedDefaultCategories, toothEventsRef } from '../src/data/toothEvents.ts';
import type { BrushingSlot, Child } from '../types/index.ts';

import { dbAs, legalVersions, startEmulator } from './emulator.ts';

const LABELS = { breakfast: 'Café', lunch: 'Almoço', dinner: 'Jantar' };
const UID = 'alice';
const LEGAL = legalVersions();
const consentInput = (existing: Awaited<ReturnType<typeof fetchUserProfile>> | undefined) => ({
  displayName: 'Ana',
  locale: 'pt-BR' as const,
  termsVersion: LEGAL.terms,
  privacyVersion: LEGAL.privacy,
  existing,
});

let env: RulesTestEnvironment;
let db: Firestore;
before(async () => {
  env = await startEmulator();
});
after(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  db = dbAs(env, UID);
  // Children can only exist after consent (rules).
  await saveConsent(db, UID, consentInput(null));
});

/** First listener emission that satisfies `ready`. */
function nextValue<T>(watch: (cb: (v: T) => void) => () => void, ready: (v: T) => boolean = () => true): Promise<T> {
  return new Promise((resolve) => {
    const stop = watch((v) => {
      if (ready(v)) {
        stop();
        resolve(v);
      }
    });
  });
}

const slotsOf = (childId: string) =>
  nextValue<BrushingSlot[]>((cb) => watchSlots(db, UID, childId, cb), (s) => s.length > 0);

async function newChild(name = 'Leo'): Promise<string> {
  const { id, written } = createChild(db, UID, { name, avatarColor: '#1690d2', avatarIcon: 'shark' }, LABELS);
  await written;
  return id;
}

test('createChild writes the child and its three default meal slots', async () => {
  const id = await newChild();
  const children = await nextValue<Child[]>((cb) => watchChildren(db, UID, cb), (c) => c.length > 0);
  assert.equal(children[0].name, 'Leo');
  assert.equal(children[0].birthYear, undefined);
  assert.equal(children[0].kidMode, false);

  const slots = await slotsOf(id);
  assert.deepEqual(
    slots.sort((a, b) => a.sortOrder - b.sortOrder).map((s) => [s.mealType, s.label]),
    [
      ['breakfast', 'Café'],
      ['lunch', 'Almoço'],
      ['dinner', 'Jantar'],
    ],
  );
});

test('updateChild sets and clears the optional birth year', async () => {
  const id = await newChild();
  await updateChild(db, UID, id, { birthYear: 2019 });
  let [c] = await nextValue<Child[]>((cb) => watchChildren(db, UID, cb), (l) => l[0]?.birthYear === 2019);
  assert.equal(c.birthYear, 2019);
  await updateChild(db, UID, id, { birthYear: undefined });
  [c] = await nextValue<Child[]>((cb) => watchChildren(db, UID, cb), (l) => l[0]?.birthYear === undefined);
  assert.equal(c.birthYear, undefined);
});

test('removeSlot hard-deletes a slot without sessions', async () => {
  const id = await newChild();
  const { id: slotId, written } = addSlot(db, UID, id, {
    label: 'Lanche',
    icon: 'star',
    mealType: 'custom',
    windowStart: '16:00',
    windowEnd: '17:00',
    sortOrder: 3,
  });
  await written;
  assert.equal(await hasSessionsForSlot(db, UID, id, slotId), false);

  const removal = await removeSlot(db, UID, id, slotId);
  await removal.written;
  assert.equal(removal.action, 'delete');
  const left = (await getDocs(slotsRef(db, UID, id))).docs.map((d) => d.id);
  assert.ok(!left.includes(slotId));
});

test('removeSlot archives a slot that has sessions, and past days still see it', async () => {
  const id = await newChild();
  const lunch = (await slotsOf(id)).find((s) => s.mealType === 'lunch');
  assert.ok(lunch);
  const brushedAt = new Date();
  await writeSession(db, UID, id, { id: 's1', slotId: lunch.id, date: localDate(brushedAt), startedAt: brushedAt, durationSec: 120, completed: true });
  assert.equal(await hasSessionsForSlot(db, UID, id, lunch.id), true);

  const removal = await removeSlot(db, UID, id, lunch.id);
  await removal.written;
  assert.equal(removal.action, 'archive');

  const slots = await nextValue<BrushingSlot[]>(
    (cb) => watchSlots(db, UID, id, cb),
    (s) => s.some((x) => x.id === lunch.id && x.archivedAt),
  );
  const archived = slots.find((s) => s.id === lunch.id);
  assert.ok(archived?.archivedAt);
  // Archived today: still part of today (the session above stays counted)…
  assert.ok(slotsActiveOn(slots, localDate(new Date())).some((s) => s.id === lunch.id));
  // …and gone from tomorrow on.
  const tomorrow = new Date(Date.now() + 86_400_000);
  assert.ok(!slotsActiveOn(slots, localDate(tomorrow)).some((s) => s.id === lunch.id));
});

test('watchSessionsOn sees only that date (the reminders skip a slot already brushed)', async () => {
  const id = await newChild();
  await writeSession(db, UID, id, { id: 'a', slotId: 'x', date: '2026-11-26', startedAt: new Date('2026-11-26T10:00:00Z'), durationSec: 120, completed: true });
  await writeSession(db, UID, id, { id: 'b', slotId: 'y', date: '2026-11-27', startedAt: new Date('2026-11-27T10:00:00Z'), durationSec: 30, completed: false });
  const sessions = await nextValue<{ id: string; date: string }[]>((cb) => watchSessionsOn(db, UID, id, '2026-11-27', cb), (s) => s.length > 0);
  assert.deepEqual(sessions.map((s) => [s.id, s.date]), [['b', '2026-11-27']]);
});

test('deleteChild removes the child and every subcollection', async () => {
  const id = await newChild();
  await writeSession(db, UID, id, { id: 's1', slotId: 'x', date: '2026-10-31', startedAt: new Date(), durationSec: 60, completed: false });
  await addToothEvents(db, UID, id, [{ fdi: 55, type: 'symptom', categoryId: 'pain', note: '', date: '2026-10-31' }]);
  const keep = await newChild('Bia');

  await deleteChild(db, UID, id);

  for (const sub of ['brushingSlots', 'brushingSessions', 'toothEvents']) {
    assert.equal((await getDocs(collection(childrenRef(db, UID), id, sub))).size, 0, sub);
  }
  const remaining = (await getDocs(childrenRef(db, UID))).docs.map((d) => d.id);
  assert.deepEqual(remaining, [keep]);
  assert.equal((await getDocs(slotsRef(db, UID, keep))).size, 3, "the other child's slots are untouched");
});

test('consent round-trips through the user profile', async () => {
  await env.clearFirestore();
  assert.equal(await fetchUserProfile(db, UID), null);
  await saveConsent(db, UID, consentInput(null));
  const profile = await fetchUserProfile(db, UID);
  assert.equal(profile?.consent?.termsVersion, LEGAL.terms);
  assert.equal(profile?.consent?.privacyVersion, LEGAL.privacy);
  assert.equal(profile?.consent?.healthData, true);
  assert.ok(profile?.consent?.acceptedAt instanceof Date);
});

test('re-consent keeps the account date, known or not (offline merge)', async () => {
  const first = await fetchUserProfile(db, UID);
  assert.ok(first);
  await saveConsent(db, UID, consentInput(first));
  await saveConsent(db, UID, consentInput(undefined)); // offline: profile unknown
  assert.equal((await fetchUserProfile(db, UID))?.createdAt.getTime(), first.createdAt.getTime());
});

test('a consent lost before reaching the server is re-sent, and child writes work again', async () => {
  // The device kept "accepted here, not confirmed"; the server never got it.
  await env.clearFirestore();
  const local = localConsentRecord(LEGAL, false);
  await assert.rejects(createChild(db, UID, { name: 'Leo', avatarColor: '#1690d2', avatarIcon: 'shark' }, LABELS).written);

  const plan = planConsentCheck(local, { reachable: true, profile: await fetchUserProfile(db, UID) }, LEGAL);
  // Pending: the app stays on the consent screen (no child data) while it is re-sent.
  assert.deepEqual(plan, { status: 'pending', action: 'resend' });
  await saveConsent(db, UID, consentInput(await fetchUserProfile(db, UID)));
  assert.deepEqual(consentAfterWrite('confirmed', false), { status: 'ok', action: 'markConfirmed' });

  assert.equal(planConsentCheck(local, { reachable: true, profile: await fetchUserProfile(db, UID) }, LEGAL).action, 'markConfirmed');
  await newChild();
});

test('an offline consent on a brand-new account is refused, then the re-send creates it', async () => {
  await env.clearFirestore();
  await assert.rejects(saveConsent(db, UID, consentInput(undefined)));
  await saveConsent(db, UID, consentInput(null));
  assert.equal((await fetchUserProfile(db, UID))?.consent?.healthData, true);
});

test('exportAllData returns every document as plain JSON', async () => {
  await seedDefaultCategories(db, UID, { pain: 'Dor' });
  const id = await newChild();
  await writeSession(db, UID, id, { id: 's1', slotId: 'x', date: '2026-10-31', startedAt: new Date('2026-10-31T10:00:00Z'), durationSec: 120, completed: true });

  const data = await exportAllData(db, UID);
  assert.equal(data.user?.displayName, 'Ana');
  assert.equal(data.categories.length, 7);
  assert.equal(data.children.length, 1);
  assert.equal(data.children[0].brushingSlots.length, 3);
  assert.equal(data.children[0].brushingSessions[0].startedAt, '2026-10-31T10:00:00.000Z');
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(data)));
});

test('deleteAllUserData leaves nothing under users/{uid}', async () => {
  await seedDefaultCategories(db, UID, {});
  const id = await newChild();
  await writeSession(db, UID, id, { id: 's1', slotId: 'x', date: '2026-10-31', startedAt: new Date(), durationSec: 120, completed: true });
  await newChild('Bia');

  await deleteAllUserData(db, UID);

  assert.equal(await fetchUserProfile(db, UID), null);
  assert.equal((await getDocs(childrenRef(db, UID))).size, 0);
  assert.equal((await getDocs(categoriesRef(db, UID))).size, 0);
  assert.equal((await getDocs(collection(childrenRef(db, UID), id, 'brushingSessions'))).size, 0);
});

test('a late session write after deleteChild is refused, so nothing is orphaned', async () => {
  const id = await newChild();
  await deleteChild(db, UID, id);
  await assert.rejects(
    writeSession(db, UID, id, { id: 'late', slotId: 'x', date: '2026-10-31', startedAt: new Date(), durationSec: 120, completed: true }),
  );
  assert.equal((await getDocs(collection(childrenRef(db, UID), id, 'brushingSessions'))).size, 0);
});

test('addToothEvents logs one event per selected tooth in one batch', async () => {
  const id = await newChild();
  await addToothEvents(db, UID, id, [52, 74].map((fdi) => ({ fdi, type: 'treatment' as const, categoryId: 'sealant', note: '', date: '2026-10-31' })));
  const fdis = (await getDocs(toothEventsRef(db, UID, id))).docs.map((d) => d.get('fdi') as number).sort();
  assert.deepEqual(fdis, [52, 74]);
});

test('export → delete everything → import restores the same data', async () => {
  await seedDefaultCategories(db, UID, { pain: 'Dor' });
  const id = await newChild();
  await writeSession(db, UID, id, { id: 's1', slotId: 'x', date: '2026-10-31', startedAt: new Date('2026-10-31T10:00:00Z'), durationSec: 120, completed: true });
  await addToothEvents(db, UID, id, [{ fdi: 55, type: 'symptom', categoryId: 'pain', note: 'molar', date: '2026-10-31' }]);
  const before = await exportAllData(db, UID);

  await deleteAllUserData(db, UID);
  // An erased account can't be written again (erasure marker): restore into the parent's new account.
  const fresh = dbAs(env, 'alice-new');
  await saveConsent(fresh, 'alice-new', consentInput(null));
  const backup = parseBackup(JSON.stringify(before));
  assert.ok(backup);
  const written = await importBackup(fresh, 'alice-new', backup);
  assert.equal(written, 7 + 1 + 3 + 1 + 1);

  const after = await exportAllData(fresh, 'alice-new');
  const strip = (d: typeof before) => ({ categories: d.categories, children: d.children });
  assert.deepEqual(strip(after), strip(before));
});

// ---- Needs a connection: offline it must fail fast, never hang ----

/** Offline, a "needs a connection" step must fail fast: the probe says unavailable, or the wait times out. */
const failsFastOffline = (error: unknown) =>
  error instanceof ServerTimeoutError || (error instanceof FirebaseError && error.code === 'unavailable');

test('offline, delete child / delete account / import / export fail fast instead of hanging', async () => {
  const id = await newChild();
  const backup = parseBackup(JSON.stringify(await exportAllData(db, UID)));
  assert.ok(backup);
  await disableNetwork(db);
  try {
    const started = Date.now();
    await assert.rejects(deleteChild(db, UID, id, 300), failsFastOffline);
    await assert.rejects(deleteAllUserData(db, UID, 300), failsFastOffline);
    await assert.rejects(importBackup(db, UID, backup, 300), failsFastOffline);
    await assert.rejects(exportAllData(db, UID, 300), failsFastOffline);
    // A write queued offline never settles on its own; the bound ends the wait.
    await assert.rejects(withTimeout(updateDoc(childRef(db, UID, id), { archivedAt: new Date() }), 'archive', 300), ServerTimeoutError);
    assert.ok(Date.now() - started < 10_000, 'each step gave up quickly');
  } finally {
    await enableNetwork(db);
  }
});

test('deleteChild run again after an offline failure finishes the job', async () => {
  const id = await newChild();
  await disableNetwork(db);
  await assert.rejects(deleteChild(db, UID, id, 300), failsFastOffline);
  await enableNetwork(db);
  await deleteChild(db, UID, id);
  assert.equal((await getDocs(childrenRef(db, UID))).size, 0);
  assert.equal((await getDocs(slotsRef(db, UID, id))).size, 0);
});

// ---- Erasure leaves no orphans ----

test('an interrupted child deletion is finished by account deletion: no orphan records', async () => {
  const id = await newChild();
  await writeSession(db, UID, id, { id: 's1', slotId: 'x', date: '2026-10-31', startedAt: new Date(), durationSec: 120, completed: true });
  await addToothEvents(db, UID, id, [{ fdi: 55, type: 'symptom', categoryId: 'pain', note: 'molar', date: '2026-10-31' }]);
  // deleteChild stopped right after archiving (e.g. the app was killed).
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore() as unknown as Firestore, 'users', UID, 'children', id), { archivedAt: new Date() }, { merge: true });
  });

  await deleteAllUserData(db, UID);

  for (const sub of ['brushingSlots', 'brushingSessions', 'toothEvents']) {
    assert.equal((await getDocs(collection(childrenRef(db, UID), id, sub))).size, 0, sub);
  }
  assert.equal((await getDocs(childrenRef(db, UID))).size, 0);
});

test('a second device cannot add records while the account is being erased', async () => {
  const id = await newChild();
  const otherDevice = dbAs(env, UID);
  await deleteAllUserData(db, UID);
  await assert.rejects(writeSession(otherDevice, UID, id, { id: 'late', slotId: 'x', date: '2026-10-31', startedAt: new Date(), durationSec: 120, completed: true }));
  await assert.rejects(createChild(otherDevice, UID, { name: 'Bia', avatarColor: '#1690d2', avatarIcon: 'shark' }, LABELS).written);
  assert.equal((await getDocs(childrenRef(db, UID))).size, 0);
});

test('a family-size import (hundreds of sessions) fits the rules and batch limits', async () => {
  const id = await newChild();
  for (let i = 0; i < 3; i++) {
    await writeSession(db, UID, id, { id: `seed${i}`, slotId: 'x', date: '2026-10-31', startedAt: new Date(), durationSec: 120, completed: true });
  }
  const exported = await exportAllData(db, UID);
  const sessions = Array.from({ length: 600 }, (_, i) => ({
    id: `s${i}`, slotId: 'x', date: '2026-10-31', startedAt: '2026-10-31T10:00:00.000Z', durationSec: 120, completed: true,
  }));
  const backup = parseBackup(JSON.stringify({ ...exported, children: [{ ...exported.children[0], brushingSessions: sessions }] }));
  assert.ok(backup);
  assert.equal(await importBackup(db, UID, backup), 1 + 3 + 600);
  assert.equal((await getDocs(collection(childrenRef(db, UID), id, 'brushingSessions'))).size, 603);
});

// ---- Cut-off operations are finished, not reported as failed (lib/account.ts reconcile) ----

test('a delete cut off after its writes were queued: the late write lands, and running it again finishes the job', async () => {
  const id = await newChild();
  await writeSession(db, UID, id, { id: 's1', slotId: 'x', date: '2026-10-31', startedAt: new Date(), durationSec: 120, completed: true });
  // The network drops after the connection check: the archive write is queued and the wait times out.
  await disableNetwork(db);
  await assert.rejects(withTimeout(updateDoc(childRef(db, UID, id), { archivedAt: new Date() }), 'archive child', 300), ServerTimeoutError);
  await enableNetwork(db);
  // Back online the queued write still lands: the child is hidden but its records remain —
  // a stale "failed" message would be wrong. The remembered operation runs again:
  await withTimeout(waitForPendingWrites(db), 'queued archive lands', 10_000);
  assert.notEqual((await getDocFromServer(childRef(db, UID, id))).get('archivedAt'), null);
  await deleteChild(db, UID, id);
  assert.equal((await getDocs(childrenRef(db, UID))).size, 0);
  assert.equal((await getDocs(collection(childrenRef(db, UID), id, 'brushingSessions'))).size, 0);
});

test('a resumed account erasure also empties a known child whose document is already gone', async () => {
  const id = await newChild();
  await writeSession(db, UID, id, { id: 's1', slotId: 'x', date: '2026-10-31', startedAt: new Date(), durationSec: 120, completed: true });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const admin = ctx.firestore() as unknown as Firestore;
    await deleteDoc(doc(admin, 'users', UID, 'children', id)); // orphaned: invisible to child enumeration
  });
  await deleteAllUserData(db, UID, 15_000, [id]);
  assert.equal((await getDocs(collection(childrenRef(db, UID), id, 'brushingSessions'))).size, 0);
  assert.equal((await getDocs(collection(childrenRef(db, UID), id, 'brushingSlots'))).size, 0);
});

test('after erasure starts a second device cannot recreate the profile; a retry of the erasure still works', async () => {
  await newChild();
  await deleteAllUserData(db, UID);
  const otherDevice = dbAs(env, UID);
  await assert.rejects(saveConsent(otherDevice, UID, consentInput(null)));
  await assert.rejects(saveConsent(otherDevice, UID, consentInput(undefined)));
  assert.equal(await fetchUserProfile(db, UID), null);
  await deleteAllUserData(db, UID); // resumable: the marker is rewritten, nothing else to do
  assert.equal((await getDocs(childrenRef(db, UID))).size, 0);
});

