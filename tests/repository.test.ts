/// <reference types="node" />
// Repository layer against the Firestore emulator, with the real rules — run: npm run test:emulator
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';

import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, getDocs, type Firestore } from 'firebase/firestore';

import { deleteAllUserData, exportAllData, fetchUserProfile, saveConsent } from '../src/data/account.ts';
import { childrenRef, createChild, deleteChild, updateChild, watchChildren } from '../src/data/children.ts';
import { localDate, slotsActiveOn } from '../src/data/schedule.ts';
import { hasSessionsForSlot, writeSession } from '../src/data/sessions.ts';
import { addSlot, removeSlot, slotsRef, watchSlots } from '../src/data/slots.ts';
import { addToothEvent, addToothEvents, categoriesRef, seedDefaultCategories, toothEventsRef } from '../src/data/toothEvents.ts';
import type { BrushingSlot, Child } from '../types/index.ts';

import { dbAs, startEmulator } from './emulator.ts';

const LABELS = { breakfast: 'Café', lunch: 'Almoço', dinner: 'Jantar' };
const UID = 'alice';

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
  await saveConsent(db, UID, { displayName: 'Ana', locale: 'pt-BR', termsVersion: 't1', privacyVersion: 'p1' });
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
  assert.equal(children[0].kidMode, true);

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

test('deleteChild removes the child and every subcollection', async () => {
  const id = await newChild();
  await writeSession(db, UID, id, { id: 's1', slotId: 'x', date: '2026-10-31', startedAt: new Date(), durationSec: 60, completed: false });
  await addToothEvent(db, UID, id, { fdi: 55, type: 'symptom', categoryId: 'pain', note: '', date: '2026-10-31' }).written;
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
  await saveConsent(db, UID, { displayName: 'Ana', locale: 'pt-BR', termsVersion: 't1', privacyVersion: 'p1' });
  const profile = await fetchUserProfile(db, UID);
  assert.equal(profile?.consent?.termsVersion, 't1');
  assert.equal(profile?.consent?.privacyVersion, 'p1');
  assert.ok(profile?.consent?.acceptedAt instanceof Date);
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
