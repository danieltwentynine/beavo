/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { NO_LOCK, afterWrongPin, isLocked, isPinLock } from './pinLock.ts';

test('pin lock: four free tries, then a wait that doubles and is capped', () => {
  const now = 1_000_000;
  let lock = NO_LOCK;
  for (let i = 0; i < 4; i++) {
    lock = afterWrongPin(lock, now);
    assert.equal(isLocked(lock, now), false);
  }
  lock = afterWrongPin(lock, now);
  assert.equal(lock.lockedUntil, now + 60_000);
  assert.equal(isLocked(lock, now + 59_999), true);
  assert.equal(isLocked(lock, now + 60_000), false);
  lock = afterWrongPin(lock, now);
  assert.equal(lock.lockedUntil, now + 120_000);
  for (let i = 0; i < 20; i++) lock = afterWrongPin(lock, now);
  assert.equal(lock.lockedUntil, now + 64 * 60_000);
});

test('isPinLock rejects malformed stored values', () => {
  assert.equal(isPinLock({ fails: 2, lockedUntil: 0 }), true);
  assert.equal(isPinLock({ fails: -1, lockedUntil: 0 }), false);
  assert.equal(isPinLock({ fails: 1 }), false);
  assert.equal(isPinLock(null), false);
});
