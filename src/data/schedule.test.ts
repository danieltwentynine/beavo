// Run: node --test src/data/*.test.ts   (Node ≥ 23.6 strips types natively)
/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { BrushingSlot } from '@/types';

import {
  canRemoveSlot,
  currentSlots,
  defaultSlots,
  isValidWindow,
  localDate,
  moveSlot,
  pickSlotForTime,
  slotRemoval,
  slotsActiveOn,
} from './schedule.ts';

const at = (iso: string) => new Date(iso); // no Z → local time
const slot = (id: string, over: Partial<BrushingSlot> = {}): BrushingSlot => ({
  id,
  label: id,
  icon: 'sun',
  mealType: 'custom',
  windowStart: '06:00',
  windowEnd: '10:00',
  sortOrder: 0,
  createdAt: at('2026-10-01T08:00:00'),
  ...over,
});

test('localDate uses the local calendar day', () => {
  assert.equal(localDate(at('2026-01-05T00:00:00')), '2026-01-05');
  assert.equal(localDate(at('2026-12-31T23:59:59')), '2026-12-31');
});

test('defaultSlots: breakfast, lunch, dinner with valid, ordered windows', () => {
  const slots = defaultSlots({ breakfast: 'Café', lunch: 'Almoço', dinner: 'Jantar' });
  assert.deepEqual(slots.map((s) => s.mealType), ['breakfast', 'lunch', 'dinner']);
  assert.deepEqual(slots.map((s) => s.label), ['Café', 'Almoço', 'Jantar']);
  assert.deepEqual(slots.map((s) => s.sortOrder), [0, 1, 2]);
  for (const s of slots) assert.ok(isValidWindow(s.windowStart, s.windowEnd));
});

test('isValidWindow rejects bad times and overnight windows', () => {
  assert.ok(isValidWindow('06:00', '10:00'));
  assert.ok(!isValidWindow('10:00', '06:00'));
  assert.ok(!isValidWindow('10:00', '10:00'));
  assert.ok(!isValidWindow('24:00', '25:00'));
  assert.ok(!isValidWindow('6:00', '10:00'));
});

test('slotsActiveOn: a slot counts on days between its creation and archive day, inclusive', () => {
  const lunch = slot('lunch', { createdAt: at('2026-10-10T20:00:00'), archivedAt: at('2026-10-20T09:00:00') });
  assert.deepEqual(slotsActiveOn([lunch], '2026-10-09'), []); // before created
  assert.deepEqual(slotsActiveOn([lunch], '2026-10-10').map((s) => s.id), ['lunch']); // created that evening
  assert.deepEqual(slotsActiveOn([lunch], '2026-10-15').map((s) => s.id), ['lunch']);
  assert.deepEqual(slotsActiveOn([lunch], '2026-10-20').map((s) => s.id), ['lunch']); // archived that day
  assert.deepEqual(slotsActiveOn([lunch], '2026-10-21'), []); // after archive
});

test('slotsActiveOn: past days keep the slots of that day, sorted', () => {
  const slots = [
    slot('dinner', { sortOrder: 2 }),
    slot('breakfast', { sortOrder: 0, archivedAt: at('2026-10-05T12:00:00') }),
    slot('snack', { sortOrder: 1, createdAt: at('2026-10-07T12:00:00') }),
  ];
  assert.deepEqual(slotsActiveOn(slots, '2026-10-03').map((s) => s.id), ['breakfast', 'dinner']);
  assert.deepEqual(slotsActiveOn(slots, '2026-10-06').map((s) => s.id), ['dinner']);
  assert.deepEqual(slotsActiveOn(slots, '2026-10-08').map((s) => s.id), ['snack', 'dinner']);
});

test('currentSlots drops archived slots', () => {
  const slots = [slot('a', { sortOrder: 1 }), slot('b', { archivedAt: at('2026-10-02T00:00:00') }), slot('c', { sortOrder: 0 })];
  assert.deepEqual(currentSlots(slots).map((s) => s.id), ['c', 'a']);
});

test('pickSlotForTime: inside a window wins, else the nearest edge', () => {
  const slots = [
    slot('breakfast', { windowStart: '06:00', windowEnd: '10:00', sortOrder: 0 }),
    slot('lunch', { windowStart: '11:00', windowEnd: '15:00', sortOrder: 1 }),
    slot('dinner', { windowStart: '18:00', windowEnd: '22:00', sortOrder: 2 }),
  ];
  assert.equal(pickSlotForTime(slots, at('2026-10-01T07:30:00'))?.id, 'breakfast');
  assert.equal(pickSlotForTime(slots, at('2026-10-01T15:00:00'))?.id, 'lunch');
  assert.equal(pickSlotForTime(slots, at('2026-10-01T16:00:00'))?.id, 'lunch'); // 60 vs 120 min
  assert.equal(pickSlotForTime(slots, at('2026-10-01T17:30:00'))?.id, 'dinner');
  assert.equal(pickSlotForTime(slots, at('2026-10-01T23:50:00'))?.id, 'dinner');
  assert.equal(pickSlotForTime(slots, at('2026-10-01T03:00:00'))?.id, 'breakfast');
  assert.equal(pickSlotForTime([], at('2026-10-01T03:00:00')), null);
});

test('slotRemoval: archive unless the server confirmed there are no sessions', () => {
  assert.equal(slotRemoval(true), 'archive');
  assert.equal(slotRemoval(null), 'archive');
  assert.equal(slotRemoval(false), 'delete');
});

test('canRemoveSlot keeps at least one slot', () => {
  assert.ok(!canRemoveSlot([slot('a')]));
  assert.ok(canRemoveSlot([slot('a'), slot('b')]));
});

test('moveSlot swaps neighbours and stops at the ends', () => {
  const slots = [slot('a', { sortOrder: 0 }), slot('b', { sortOrder: 1 }), slot('c', { sortOrder: 2 })];
  assert.deepEqual(moveSlot(slots, 'b', -1), ['b', 'a', 'c']);
  assert.deepEqual(moveSlot(slots, 'b', 1), ['a', 'c', 'b']);
  assert.deepEqual(moveSlot(slots, 'a', -1), ['a', 'b', 'c']);
  assert.deepEqual(moveSlot(slots, 'c', 1), ['a', 'b', 'c']);
});
