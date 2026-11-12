// Device-only data self-check — run: node lib/localData.check.mjs
// Plain node + assert on purpose: this repo has no test framework and doesn't need one.
import assert from 'node:assert/strict';

import { LOCAL_UID, decodeChild, encodeChild } from './localData.ts';

const child = (over = {}) => ({
  id: 'child-1',
  parentUid: LOCAL_UID,
  name: 'Leo',
  age: 6,
  avatarId: 'shark',
  streakCurrent: 3,
  streakBest: 5,
  totalSessions: 12,
  badges: [{ id: 'first', name: 'First brush', type: 'firstSession', earnedAt: new Date('2026-08-01T07:30:00.000Z') }],
  createdAt: new Date('2026-07-30T10:00:00.000Z'),
  lastSessionAt: new Date('2026-08-28T21:00:00.000Z'),
  ...over,
});

// --- round trip ---
assert.deepEqual(decodeChild(encodeChild(child())), child(), 'a profile survives encode → decode unchanged');
const back = decodeChild(encodeChild(child()));
assert.ok(back.createdAt instanceof Date, 'createdAt comes back as a Date');
assert.ok(back.badges[0].earnedAt instanceof Date, 'badge dates come back as Dates');

const fresh = child({ lastSessionAt: undefined, badges: [], totalSessions: 0 });
assert.equal(decodeChild(encodeChild(fresh)).lastSessionAt, undefined, 'a child with no sessions has no lastSessionAt');

// --- ownership is never taken from storage ---
assert.equal(
  decodeChild(JSON.stringify({ ...child(), parentUid: 'someone-else' })).parentUid,
  LOCAL_UID,
  'a stored parentUid is ignored — device data is always owned by LOCAL_UID',
);

// --- malformed storage must never throw ---
assert.equal(decodeChild(null), null, 'nothing stored reads as no child');
assert.equal(decodeChild(''), null, 'an empty string reads as no child');
assert.equal(decodeChild('{"id":"chi'), null, 'half-written JSON is discarded, not thrown');
assert.equal(decodeChild('[]'), null, 'a non-object payload is discarded');
assert.equal(decodeChild(JSON.stringify({ ...child(), id: '' })), null, 'an empty id is rejected');
assert.equal(decodeChild(JSON.stringify({ ...child(), age: 'six' })), null, 'a wrong field type is rejected');
assert.equal(
  decodeChild(JSON.stringify({ ...child(), createdAt: 'yesterday-ish' })),
  null,
  'an unparseable date is rejected',
);

// --- older profiles without counters ---
const { streakCurrent, streakBest, totalSessions, badges, ...bare } = JSON.parse(encodeChild(child()));
const upgraded = decodeChild(JSON.stringify(bare));
assert.deepEqual(
  [upgraded.streakCurrent, upgraded.streakBest, upgraded.totalSessions, upgraded.badges],
  [0, 0, 0, []],
  'missing counters default to zero',
);

console.log('localData: all checks passed');
