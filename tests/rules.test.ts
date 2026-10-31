/// <reference types="node" />
// Security rules tests — run: npm run test:emulator
import { after, before, beforeEach, describe, test } from 'node:test';

import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

import { dbAnonymous, dbAs, startEmulator } from './emulator.ts';

let env: RulesTestEnvironment;
before(async () => {
  env = await startEmulator();
});
after(async () => {
  await env.cleanup();
});
const consented = { termsVersion: '2026-10-31', privacyVersion: '2026-10-31', acceptedAt: Timestamp.now() };

beforeEach(async () => {
  await env.clearFirestore();
  // Baseline: alice has consented and has child c1 (written with rules off).
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Parameters<typeof doc>[0];
    await setDoc(doc(db, 'users/alice'), { displayName: 'Ana', locale: 'pt-BR', createdAt: Timestamp.now(), consent: consented });
    await setDoc(doc(db, 'users/alice/children/c1'), {
      name: 'Leo', avatarColor: '#1690d2', avatarIcon: 'shark', kidMode: true, createdAt: Timestamp.now(), archivedAt: null,
    });
  });
});

const now = Timestamp.now();
const user = { displayName: 'Ana', locale: 'pt-BR', createdAt: now };
const child = { name: 'Leo', avatarColor: '#1690d2', avatarIcon: 'shark', birthYear: 2019, kidMode: true, createdAt: now, archivedAt: null };
const slot = { label: 'Depois do almoço', icon: 'sun', mealType: 'lunch', windowStart: '11:00', windowEnd: '15:00', sortOrder: 1, createdAt: now, archivedAt: null };
const session = { slotId: 'slot1', date: '2026-10-31', startedAt: now, durationSec: 120, completed: true };
const toothEvent = { fdi: 55, type: 'symptom', categoryId: 'pain', note: '', date: '2026-10-31' };
const category = { name: 'Dor', type: 'symptom', color: '#FFB347', isDefault: true };

const CHILD = 'users/alice/children/c1';

describe('ownership', () => {
  test('signed-out users can read and write nothing', async () => {
    const db = dbAnonymous(env);
    await assertFails(getDoc(doc(db, 'users/alice')));
    await assertFails(setDoc(doc(db, 'users/alice'), user));
    await assertFails(getDoc(doc(db, CHILD)));
  });

  test('a parent reads and writes only under their own uid', async () => {
    const alice = dbAs(env, 'alice');
    const bob = dbAs(env, 'bob');
    await assertSucceeds(getDoc(doc(alice, 'users/alice')));
    await assertSucceeds(getDoc(doc(alice, CHILD)));
    await assertFails(getDoc(doc(bob, 'users/alice')));
    await assertFails(getDoc(doc(bob, CHILD)));
    await assertFails(setDoc(doc(bob, `${CHILD}/brushingSessions/s1`), session));
    await assertFails(deleteDoc(doc(bob, CHILD)));
    await assertFails(setDoc(doc(bob, 'users/alice/categories/pain'), category));
  });

  test('no child or category before consent', async () => {
    const carol = dbAs(env, 'carol');
    await assertFails(setDoc(doc(carol, 'users/carol/children/k1'), child));
    await assertFails(setDoc(doc(carol, 'users/carol/categories/pain'), category));
    await assertSucceeds(setDoc(doc(carol, 'users/carol'), { ...user, consent: consented }));
    await assertSucceeds(setDoc(doc(carol, 'users/carol/children/k1'), child));
    await assertSucceeds(setDoc(doc(carol, 'users/carol/categories/pain'), category));
  });

  test('no writes under a missing or archived (being deleted) child', async () => {
    const alice = dbAs(env, 'alice');
    await assertFails(setDoc(doc(alice, 'users/alice/children/ghost/brushingSessions/s1'), session));
    await assertFails(setDoc(doc(alice, 'users/alice/children/ghost/brushingSlots/x'), slot));
    await assertFails(setDoc(doc(alice, 'users/alice/children/ghost/toothEvents/e1'), toothEvent));
    await assertSucceeds(updateDoc(doc(alice, CHILD), { archivedAt: Timestamp.now() }));
    await assertFails(setDoc(doc(alice, `${CHILD}/brushingSessions/s1`), session));
    // Deleting what's left is still allowed.
    await assertSucceeds(deleteDoc(doc(alice, CHILD)));
  });

  test('legacy top-level collections and unknown paths are denied', async () => {
    const alice = dbAs(env, 'alice');
    await assertFails(setDoc(doc(alice, 'children/x'), { parentUid: 'alice', name: 'Leo' }));
    await assertFails(getDoc(doc(alice, 'sessions/x')));
    await assertFails(setDoc(doc(alice, 'users/alice/secrets/x'), { a: 1 }));
  });
});

describe('users/{uid}', () => {
  test('profile with consent is accepted', async () => {
    const alice = dbAs(env, 'alice');
    await assertSucceeds(
      setDoc(doc(alice, 'users/alice'), { ...user, consent: { termsVersion: '2026-10-31', privacyVersion: '2026-10-31', acceptedAt: now } }),
    );
  });

  test('extra fields (e.g. email), bad locale and bad consent are rejected', async () => {
    const alice = dbAs(env, 'alice');
    await assertFails(setDoc(doc(alice, 'users/alice'), { ...user, email: 'ana@example.com' }));
    await assertFails(setDoc(doc(alice, 'users/alice'), { ...user, locale: 'fr' }));
    await assertFails(setDoc(doc(alice, 'users/alice'), { ...user, consent: { termsVersion: '', privacyVersion: 'x', acceptedAt: now } }));
    await assertFails(setDoc(doc(alice, 'users/alice'), { displayName: 'Ana', locale: 'en' }));
  });
});

describe('children', () => {
  test('valid child; birthYear optional or null', async () => {
    const alice = dbAs(env, 'alice');
    await assertSucceeds(setDoc(doc(alice, 'users/alice/children/c4'), child));
    const { birthYear: _omit, ...noYear } = child;
    await assertSucceeds(setDoc(doc(alice, 'users/alice/children/c2'), noYear));
    await assertSucceeds(setDoc(doc(alice, 'users/alice/children/c3'), { ...child, birthYear: null }));
  });

  test('bad fields are rejected', async () => {
    const alice = dbAs(env, 'alice');
    const bad = [
      { ...child, name: '' },
      { ...child, name: 'x'.repeat(41) },
      { ...child, avatarColor: 'blue' },
      { ...child, birthYear: '2019' },
      { ...child, kidMode: 'yes' },
      { ...child, lastName: 'Silva' },
      { ...child, createdAt: '2026-10-31' },
    ];
    for (const data of bad) await assertFails(setDoc(doc(alice, 'users/alice/children/c9'), data));
  });

  test('createdAt cannot be moved on update', async () => {
    const alice = dbAs(env, 'alice');
    await assertSucceeds(updateDoc(doc(alice, CHILD), { name: 'Léo' }));
    await assertFails(updateDoc(doc(alice, CHILD), { createdAt: Timestamp.fromMillis(0) }));
  });
});

describe('brushing slots', () => {
  test('valid slot; archiving sets archivedAt', async () => {
    const alice = dbAs(env, 'alice');
    const ref = doc(alice, `${CHILD}/brushingSlots/slot1`);
    await assertSucceeds(setDoc(ref, slot));
    await assertSucceeds(updateDoc(ref, { archivedAt: Timestamp.now() }));
  });

  test('bad windows, meal types and order are rejected', async () => {
    const alice = dbAs(env, 'alice');
    const ref = doc(alice, `${CHILD}/brushingSlots/slot1`);
    for (const data of [
      { ...slot, windowStart: '15:00', windowEnd: '11:00' },
      { ...slot, windowStart: '25:00' },
      { ...slot, windowEnd: '9:00' },
      { ...slot, mealType: 'snack' },
      { ...slot, sortOrder: -1 },
      { ...slot, label: '' },
    ]) {
      await assertFails(setDoc(ref, data));
    }
  });
});

describe('sessions, tooth events, categories', () => {
  test('valid session; retry overwrites the same id', async () => {
    const alice = dbAs(env, 'alice');
    const ref = doc(alice, `${CHILD}/brushingSessions/s1`);
    await assertSucceeds(setDoc(ref, session));
    await assertSucceeds(setDoc(ref, session));
  });

  test('bad sessions are rejected', async () => {
    const alice = dbAs(env, 'alice');
    const ref = doc(alice, `${CHILD}/brushingSessions/s1`);
    for (const data of [
      { ...session, date: '31/10/2026' },
      { ...session, durationSec: -5 },
      { ...session, durationSec: 12.5 },
      { ...session, slotId: '' },
      { ...session, score: 80 },
    ]) {
      await assertFails(setDoc(ref, data));
    }
  });

  test('tooth events need a real FDI number', async () => {
    const alice = dbAs(env, 'alice');
    const ref = doc(alice, `${CHILD}/toothEvents/e1`);
    await assertSucceeds(setDoc(ref, toothEvent));
    await assertSucceeds(setDoc(ref, { ...toothEvent, fdi: 36, type: 'treatment', categoryId: 'filling' }));
    for (const fdi of [10, 19, 49, 56, 86, 9]) await assertFails(setDoc(ref, { ...toothEvent, fdi }));
    await assertFails(setDoc(ref, { ...toothEvent, note: 'x'.repeat(501) }));
  });

  test('categories are validated', async () => {
    const alice = dbAs(env, 'alice');
    await assertSucceeds(setDoc(doc(alice, 'users/alice/categories/pain'), category));
    await assertFails(setDoc(doc(alice, 'users/alice/categories/x'), { ...category, type: 'other' }));
    await assertFails(setDoc(doc(alice, 'users/alice/categories/x'), { ...category, color: 'red' }));
  });
});
