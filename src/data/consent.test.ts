/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { UserProfile } from '../../types/index.ts';

import { consentAfterWrite, isCurrentConsent, localConsentRecord, parseLocalConsent, planConsentCheck } from './consent.ts';

const V = { terms: '2026-11-22', privacy: '2026-11-22' };
const pending = localConsentRecord(V, false);
const confirmed = localConsentRecord(V, true);
const profile = (consent?: UserProfile['consent']): UserProfile => ({ displayName: 'Ana', locale: 'pt-BR', createdAt: new Date(), consent });
const current = { termsVersion: V.terms, privacyVersion: V.privacy, healthData: true, acceptedAt: new Date() };

test('a consent the server has not confirmed is pending — never ok — and is re-sent (online, offline, after a restart)', () => {
  // Restart with a pending record: same answer, read back from storage.
  const restored = parseLocalConsent(JSON.stringify(pending));
  for (const local of [pending, restored]) {
    assert.deepEqual(planConsentCheck(local, { reachable: true, profile: profile() }, V), { status: 'pending', action: 'resend' });
    assert.deepEqual(planConsentCheck(local, { reachable: true, profile: null }, V), { status: 'pending', action: 'resend' });
    assert.deepEqual(planConsentCheck(local, { reachable: false }, V), { status: 'pending', action: 'resend' });
  }
});

test('after a consent write: confirmed unlocks, a timeout stays pending, a refusal drops it and asks again', () => {
  assert.deepEqual(consentAfterWrite('confirmed', false), { status: 'ok', action: 'markConfirmed' });
  assert.deepEqual(consentAfterWrite('timeout', false), { status: 'pending', action: 'none' });
  assert.deepEqual(consentAfterWrite('refused', false), { status: 'needed', action: 'forget' });
  assert.deepEqual(consentAfterWrite('refused', true), { status: 'updated', action: 'forget' });
});

test('the server confirming marks the device record confirmed; nothing more to do after', () => {
  assert.deepEqual(planConsentCheck(pending, { reachable: true, profile: profile(current) }, V), { status: 'ok', action: 'markConfirmed' });
  assert.deepEqual(planConsentCheck(undefined, { reachable: true, profile: profile(current) }, V), { status: 'ok', action: 'markConfirmed' });
  assert.deepEqual(planConsentCheck(confirmed, { reachable: true, profile: profile(current) }, V), { status: 'ok', action: 'none' });
  assert.deepEqual(planConsentCheck(confirmed, { reachable: false }, V), { status: 'ok', action: 'none' });
});

test('a confirmed consent the server no longer has is forgotten and asked again, never revived', () => {
  assert.deepEqual(planConsentCheck(confirmed, { reachable: true, profile: null }, V), { status: 'needed', action: 'forget' });
  const old = { ...current, termsVersion: '2026-11-11' };
  assert.deepEqual(planConsentCheck(confirmed, { reachable: true, profile: profile(old) }, V), { status: 'updated', action: 'forget' });
});

test('no consent anywhere asks; an older version asks again', () => {
  assert.deepEqual(planConsentCheck(undefined, { reachable: true, profile: null }, V), { status: 'needed', action: 'none' });
  assert.deepEqual(planConsentCheck(undefined, { reachable: false }, V), { status: 'needed', action: 'none' });
  const olderLocal = { ...pending, privacyVersion: '2026-11-11' };
  assert.deepEqual(planConsentCheck(olderLocal, { reachable: false }, V), { status: 'updated', action: 'none' });
});

test('consent without the separate health-data item is not current', () => {
  assert.ok(isCurrentConsent(current, V));
  assert.ok(!isCurrentConsent({ termsVersion: V.terms, privacyVersion: V.privacy }, V));
  assert.ok(!isCurrentConsent(undefined, V));
});

test('stored records are untrusted: old or malformed ones read as none', () => {
  assert.deepEqual(parseLocalConsent(JSON.stringify(pending)), pending);
  assert.equal(parseLocalConsent(JSON.stringify({ termsVersion: V.terms, privacyVersion: V.privacy })), undefined);
  assert.equal(parseLocalConsent('{not json'), undefined);
  assert.equal(parseLocalConsent(null), undefined);
});
