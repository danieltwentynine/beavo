/// <reference types="node" />
// Security rules tests — run: npm run test:emulator
import { after, before, beforeEach, describe, test } from 'node:test';

import assert from 'node:assert/strict';

import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

import { dbAnonymous, dbAs, legalVersions, rulesVersions, startEmulator } from './emulator.ts';

let env: RulesTestEnvironment;
before(async () => {
  env = await startEmulator();
});
after(async () => {
  await env.cleanup();
});
const LEGAL = legalVersions();
// As stored (baseline, written with rules off) and as the app sends a new one.
const consented = { termsVersion: LEGAL.terms, privacyVersion: LEGAL.privacy, healthData: true, acceptedAt: Timestamp.now() };
const newConsent = () => ({ termsVersion: LEGAL.terms, privacyVersion: LEGAL.privacy, healthData: true, acceptedAt: serverTimestamp() });

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
    await assertSucceeds(setDoc(doc(carol, 'users/carol'), { ...user, consent: newConsent() }));
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

  test('a live child cannot be deleted with its records under it; archive first', async () => {
    const alice = dbAs(env, 'alice');
    await assertSucceeds(setDoc(doc(alice, `${CHILD}/brushingSessions/s1`), session));
    await assertFails(deleteDoc(doc(alice, CHILD)));
    await assertSucceeds(updateDoc(doc(alice, CHILD), { archivedAt: Timestamp.now() }));
    await assertSucceeds(deleteDoc(doc(alice, `${CHILD}/brushingSessions/s1`)));
    await assertSucceeds(deleteDoc(doc(alice, CHILD)));
  });

  test('once the profile is deleted (account erasure) only archiving and deleting work', async () => {
    const alice = dbAs(env, 'alice');
    await assertSucceeds(setDoc(doc(alice, `${CHILD}/brushingSlots/slot1`), slot));
    await assertSucceeds(deleteDoc(doc(alice, 'users/alice')));
    // A second device, still signed in, can add nothing while erasure runs.
    await assertFails(setDoc(doc(alice, `${CHILD}/brushingSessions/s1`), session));
    await assertFails(setDoc(doc(alice, `${CHILD}/brushingSlots/slot2`), slot));
    await assertFails(setDoc(doc(alice, `${CHILD}/toothEvents/e1`), toothEvent));
    await assertFails(updateDoc(doc(alice, `${CHILD}/brushingSlots/slot1`), { label: 'x' }));
    await assertFails(updateDoc(doc(alice, CHILD), { name: 'Léo' }));
    await assertFails(setDoc(doc(alice, 'users/alice/children/c2'), child));
    await assertFails(setDoc(doc(alice, 'users/alice/categories/pain'), category));
    await assertSucceeds(updateDoc(doc(alice, CHILD), { archivedAt: Timestamp.now() }));
    await assertSucceeds(deleteDoc(doc(alice, `${CHILD}/brushingSlots/slot1`)));
    await assertSucceeds(deleteDoc(doc(alice, CHILD)));
  });

  test('legacy top-level collections and unknown paths are denied', async () => {
    const alice = dbAs(env, 'alice');
    await assertFails(setDoc(doc(alice, 'children/x'), { parentUid: 'alice', name: 'Leo' }));
    await assertFails(getDoc(doc(alice, 'sessions/x')));
    await assertFails(setDoc(doc(alice, 'users/alice/secrets/x'), { a: 1 }));
  });
});

describe('consent receipt authorizes writes only while current', () => {
  test('a receipt from an earlier release (old versions, no health item) authorizes no child data; re-consent does', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Parameters<typeof doc>[0];
      await setDoc(doc(db, 'users/alice'), {
        displayName: 'Ana', locale: 'pt-BR', createdAt: now,
        consent: { termsVersion: '2026-11-11', privacyVersion: '2026-11-11', acceptedAt: Timestamp.now() },
      });
    });
    const alice = dbAs(env, 'alice');
    await assertFails(setDoc(doc(alice, `${CHILD}/brushingSessions/s1`), session));
    await assertFails(setDoc(doc(alice, `${CHILD}/toothEvents/e1`), toothEvent));
    await assertFails(setDoc(doc(alice, 'users/alice/children/c2'), child));
    await assertFails(updateDoc(doc(alice, CHILD), { name: 'Léo' }));
    await assertFails(setDoc(doc(alice, 'users/alice/categories/pain'), category));
    // Erasure access is preserved: archiving and deleting still work.
    await assertSucceeds(updateDoc(doc(alice, CHILD), { archivedAt: Timestamp.now() }));
    await assertFails(updateDoc(doc(alice, CHILD), { archivedAt: null }));
    // Re-consent with today's versions and the health item unlocks writes again.
    await assertSucceeds(updateDoc(doc(alice, 'users/alice'), { consent: newConsent() }));
    await assertSucceeds(setDoc(doc(alice, 'users/alice/children/c3'), child));
  });

  test('a current-version receipt without the health item authorizes nothing', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Parameters<typeof doc>[0];
      await setDoc(doc(db, 'users/alice'), {
        displayName: 'Ana', locale: 'pt-BR', createdAt: now,
        consent: { termsVersion: LEGAL.terms, privacyVersion: LEGAL.privacy, acceptedAt: Timestamp.now() },
      });
    });
    await assertFails(setDoc(doc(dbAs(env, 'alice'), `${CHILD}/brushingSessions/s1`), session));
  });
});

describe('erasure marker', () => {
  const marker = () => ({ startedAt: serverTimestamp() });

  test('while erasing, no device can recreate the profile or add anything; deleting still works', async () => {
    const alice = dbAs(env, 'alice');
    await assertSucceeds(setDoc(doc(alice, 'erasures/alice'), marker()));
    await assertSucceeds(deleteDoc(doc(alice, 'users/alice')));
    const otherDevice = dbAs(env, 'alice');
    await assertFails(setDoc(doc(otherDevice, 'users/alice'), { ...user, consent: newConsent() }));
    await assertFails(setDoc(doc(otherDevice, `${CHILD}/brushingSessions/s1`), session));
    await assertFails(setDoc(doc(otherDevice, 'users/alice/children/c2'), child));
    await assertSucceeds(updateDoc(doc(otherDevice, CHILD), { archivedAt: Timestamp.now() }));
    await assertSucceeds(deleteDoc(doc(otherDevice, CHILD)));
  });

  test('the marker holds only the server start time, can be rewritten on a retry, and never removed', async () => {
    const alice = dbAs(env, 'alice');
    await assertFails(setDoc(doc(alice, 'erasures/alice'), { startedAt: now }));
    await assertFails(setDoc(doc(alice, 'erasures/alice'), { ...marker(), reason: 'x' }));
    await assertFails(setDoc(doc(dbAs(env, 'bob'), 'erasures/alice'), marker()));
    await assertSucceeds(setDoc(doc(alice, 'erasures/alice'), marker()));
    await assertSucceeds(setDoc(doc(alice, 'erasures/alice'), marker()));
    await assertFails(deleteDoc(doc(alice, 'erasures/alice')));
    await assertFails(getDoc(doc(dbAs(env, 'bob'), 'erasures/alice')));
  });
});

describe('users/{uid}', () => {
  test('the rules pin the same document versions as lib/legal.ts', () => {
    assert.deepEqual(rulesVersions(), LEGAL, 'bump currentTermsVersion/currentPrivacyVersion in firestore.rules with LEGAL_VERSIONS');
  });

  test('profile with a new consent (server time, current versions, health item) is accepted', async () => {
    const dave = dbAs(env, 'dave');
    await assertSucceeds(setDoc(doc(dave, 'users/dave'), { ...user, consent: newConsent() }));
  });

  test('consent with a client time, an old version or without the health item is rejected', async () => {
    const dave = dbAs(env, 'dave');
    const ref = doc(dave, 'users/dave');
    await assertFails(setDoc(ref, { ...user, consent: { ...newConsent(), acceptedAt: now } }));
    await assertFails(setDoc(ref, { ...user, consent: { ...newConsent(), termsVersion: '2026-11-11' } }));
    await assertFails(setDoc(ref, { ...user, consent: { ...newConsent(), privacyVersion: '2026-11-11' } }));
    const { healthData: _health, ...withoutHealth } = newConsent();
    await assertFails(setDoc(ref, { ...user, consent: withoutHealth }));
    await assertFails(setDoc(ref, { ...user, consent: { ...newConsent(), healthData: false } }));
    await assertFails(setDoc(ref, { ...user, consent: { ...newConsent(), extra: 1 } }));
  });

  test('an update keeps the stored consent as it is, and never moves the account date', async () => {
    const alice = dbAs(env, 'alice');
    const stored = (await getDoc(doc(alice, 'users/alice'))).data();
    assert.ok(stored);
    await assertSucceeds(updateDoc(doc(alice, 'users/alice'), { locale: 'en' }));
    await assertFails(updateDoc(doc(alice, 'users/alice'), { 'consent.acceptedAt': Timestamp.fromMillis(1) }));
    await assertFails(updateDoc(doc(alice, 'users/alice'), { createdAt: Timestamp.fromMillis(0) }));
    await assertSucceeds(updateDoc(doc(alice, 'users/alice'), { consent: newConsent() }));
  });

  test('extra fields (e.g. email), bad locale and bad consent are rejected', async () => {
    const alice = dbAs(env, 'alice');
    await assertFails(setDoc(doc(alice, 'users/alice'), { ...user, email: 'ana@example.com' }));
    await assertFails(setDoc(doc(alice, 'users/alice'), { ...user, locale: 'fr' }));
    await assertSucceeds(setDoc(doc(alice, 'users/alice'), { ...user, createdAt: (await getDoc(doc(alice, 'users/alice'))).get('createdAt'), locale: 'es', consent: newConsent() }));
    await assertFails(setDoc(doc(alice, 'users/alice'), { ...user, consent: { termsVersion: '', privacyVersion: 'x', healthData: true, acceptedAt: serverTimestamp() } }));
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
