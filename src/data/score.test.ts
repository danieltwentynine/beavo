/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SHORT_RUN_SCORE_CAP, isPerfectScore, scoreSession } from './score.ts';

test('a full 2-minute run (or longer) scores 100 and is perfect', () => {
  for (const totalSec of [120, 150, 180]) {
    const score = scoreSession({ reachedZones: 10, zoneCount: 10, totalSec });
    assert.equal(score, 100);
    assert.ok(isPerfectScore(score));
  }
});

test('a full run shorter than 2 minutes is capped below 100 and never perfect', () => {
  for (const totalSec of [60, 90]) {
    const score = scoreSession({ reachedZones: 10, zoneCount: 10, totalSec });
    assert.equal(score, SHORT_RUN_SCORE_CAP);
    assert.ok(!isPerfectScore(score));
  }
});

test('partial runs score the share of zones reached; the cap only lowers', () => {
  assert.equal(scoreSession({ reachedZones: 5, zoneCount: 10, totalSec: 120 }), 50);
  assert.equal(scoreSession({ reachedZones: 5, zoneCount: 10, totalSec: 60 }), 50);
  assert.equal(scoreSession({ reachedZones: 0, zoneCount: 10, totalSec: 120 }), 0);
});

test('out-of-range input is clamped', () => {
  assert.equal(scoreSession({ reachedZones: 12, zoneCount: 10, totalSec: 120 }), 100);
  assert.equal(scoreSession({ reachedZones: -1, zoneCount: 10, totalSec: 120 }), 0);
  assert.equal(scoreSession({ reachedZones: 3, zoneCount: 0, totalSec: 120 }), 0);
});
