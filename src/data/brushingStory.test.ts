/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';

import { brushingStoryStep, carriedSessionCount, resolveBrushingStory, selectBrushingStory } from './brushingStory.ts';

test('saved-session count selects stories in a fixed repeating order', () => {
  assert.deepEqual(Array.from({ length: 9 }, (_, count) => selectBrushingStory(count)), [0, 1, 2, 3, 0, 1, 2, 3, 0]);
  assert.equal(selectBrushingStory(1_003), 3);
});

test('the guide presents ten story lines and holds the closing line at expiry', () => {
  assert.deepEqual(Array.from({ length: 10 }, (_, reached) => brushingStoryStep(reached)), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(brushingStoryStep(10), 9);
});

test('a late first snapshot selects the returning child’s story and later updates keep it stable', () => {
  const waiting = resolveBrushingStory(null, null);
  assert.equal(waiting, null);
  const firstSnapshot = resolveBrushingStory(waiting, 5);
  assert.equal(firstSnapshot, 1);
  assert.equal(resolveBrushingStory(firstSnapshot, 6), 1);
  assert.equal(resolveBrushingStory(null, 0), 0);
});

test('a carried count is used only for the child whose history loaded', () => {
  assert.equal(carriedSessionCount('child-a', 'child-a', '5'), 5);
  assert.equal(carriedSessionCount('child-a', 'child-a', '0'), 0);
  assert.equal(carriedSessionCount('child-b', 'child-a', '5'), null);
  assert.equal(carriedSessionCount('child-a', 'child-a', undefined), null);
});
