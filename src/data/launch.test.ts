/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { introSeenFromSaved, launchRoute } from './launch.ts';

const base = { authLoading: false, settingsLoaded: true, ownerId: null, introSeen: false };

test('first launch (intro never seen, no owner) → intro', () => {
  assert.equal(launchRoute(base), '/onboarding/intro');
});

test('later launches: intro seen → welcome without an owner, tabs (Escovação) with one', () => {
  assert.equal(launchRoute({ ...base, introSeen: true }), '/onboarding/welcome');
  assert.equal(launchRoute({ ...base, introSeen: true, ownerId: 'uid-1' }), '/(tabs)/brushing');
  assert.equal(launchRoute({ ...base, introSeen: false, ownerId: 'local' }), '/(tabs)/brushing');
});

test('nothing is decided while auth or the saved settings are still loading', () => {
  assert.equal(launchRoute({ ...base, authLoading: true }), null);
  assert.equal(launchRoute({ ...base, settingsLoaded: false, introSeen: true }), null);
});

test('the saved intro mark persists only as a literal true', () => {
  assert.equal(introSeenFromSaved({ introSeen: true, brushingDurationSec: 120 }), true);
  for (const saved of [null, undefined, {}, { introSeen: 'true' }, { introSeen: 1 }, 'introSeen', []]) {
    assert.equal(introSeenFromSaved(saved), false, JSON.stringify(saved));
  }
});
