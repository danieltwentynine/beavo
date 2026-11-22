/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { afterOwnerCheck, afterRightAnswer, firstGateStep } from './gateFlow.ts';

test('an existing PIN is never replaced without the phone confirming its owner', () => {
  assert.equal(afterOwnerCheck('noPasscode', true), 'blocked');
  assert.equal(afterOwnerCheck('error', true), 'retry');
  for (const mode of ['check', 'noNewPin', 'choosePin'] as const) assert.equal(afterRightAnswer(mode, true), 'blocked');
  assert.equal(afterOwnerCheck('success', true), 'create');
});

test('first-time setup may fall back to the written question only on a phone confirmed without a passcode', () => {
  assert.equal(afterOwnerCheck('noPasscode', false), 'math');
  // An authentication error fails closed even for first-time setup: no arithmetic.
  assert.equal(afterOwnerCheck('error', false), 'retry');
  assert.equal(afterRightAnswer('check', false), 'create');
  assert.equal(afterRightAnswer('choosePin', false), 'create');
  // Reading the Terms before consent: the question alone passes, no PIN is made.
  assert.equal(afterRightAnswer('noNewPin', false), 'pass');
});

test('cancelling Face ID keeps the gate where it is', () => {
  assert.equal(afterOwnerCheck('cancelled', true), 'stay');
  assert.equal(afterOwnerCheck('cancelled', false), 'stay');
});

test('first step per mode', () => {
  assert.equal(firstGateStep('check', true), 'pin');
  assert.equal(firstGateStep('check', false), 'owner');
  assert.equal(firstGateStep('noNewPin', true), 'pin');
  assert.equal(firstGateStep('noNewPin', false), 'math');
  assert.equal(firstGateStep('choosePin', true), 'owner');
});
