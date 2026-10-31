/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decodeOutbox, encodeOutbox, upsertEntry, type PendingSession } from './outbox.ts';

const entry = (over: Partial<Record<keyof PendingSession, unknown>> = {}): PendingSession =>
  ({
    uid: 'parent-1',
    childId: 'child-1',
    id: 'sess-1',
    slotId: 'slot-1',
    date: '2026-10-31',
    startedAt: '2026-10-31T10:00:00.000Z',
    durationSec: 120,
    completed: true,
    ...over,
  }) as PendingSession;

test('round trip keeps a session unchanged', () => {
  const one = entry();
  assert.deepEqual(decodeOutbox(encodeOutbox([one])), [one]);
});

test('empty storage reads as nothing pending', () => {
  assert.deepEqual(decodeOutbox(null), []);
  assert.deepEqual(decodeOutbox(''), []);
  assert.deepEqual(decodeOutbox('[]'), []);
});

test('malformed storage never throws', () => {
  assert.deepEqual(decodeOutbox('{"id":"sess'), []);
  assert.deepEqual(decodeOutbox('"not an array"'), []);
  assert.deepEqual(decodeOutbox(JSON.stringify([null, 7, 'x'])), []);
});

test('bad entries are dropped one by one; the valid one survives', () => {
  const mixed = JSON.stringify([
    entry({ id: '' }),
    { id: 'old-shape', score: 50, completedAt: '2026-01-01T00:00:00Z' }, // v1 outbox entry
    entry({ startedAt: 'not-a-date' }),
    entry({ date: '31/10/2026' }),
    entry({ durationSec: -1 }),
    entry({ uid: undefined }), // can't know whose data it is
    entry({ id: 'good' }),
  ]);
  assert.deepEqual(decodeOutbox(mixed).map((e) => e.id), ['good']);
});

test('the outbox is capped, keeping the newest', () => {
  const many = Array.from({ length: 60 }, (_, i) => entry({ id: `s${i}` }));
  const kept = decodeOutbox(encodeOutbox(many));
  assert.equal(kept.length, 50);
  assert.equal(kept[0].id, 's10');
  assert.equal(kept.at(-1)?.id, 's59');
});

test('upsertEntry replaces by id', () => {
  const a = entry({ id: 'a', durationSec: 30 });
  const b = entry({ id: 'b' });
  const a2 = entry({ id: 'a', durationSec: 120 });
  assert.deepEqual(upsertEntry([a, b], a2), [b, a2]);
});
