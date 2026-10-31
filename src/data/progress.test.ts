/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { BrushingSession, BrushingSlot } from '@/types';

import { addDays, dayStatus, sessionsNewestFirst, summarizeProgress, weekOf } from './progress.ts';

const at = (iso: string) => new Date(iso); // local time
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
let n = 0;
const brushed = (slotId: string, date: string, completed = true): BrushingSession => ({
  id: `s${n++}`,
  slotId,
  date,
  startedAt: at(`${date}T08:00:00`),
  durationSec: completed ? 120 : 40,
  completed,
});

const breakfast = slot('b', { windowStart: '06:00', windowEnd: '10:00', sortOrder: 0 });
const dinner = slot('d', { windowStart: '18:00', windowEnd: '22:00', sortOrder: 1 });
const slots = [breakfast, dinner];
const both = (date: string) => [brushed('b', date), brushed('d', date)];

test('addDays crosses month ends and DST', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-11-01', 1), '2026-11-02');
});

test('weekOf runs Monday to Sunday', () => {
  assert.deepEqual(weekOf('2026-10-31'), ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
  assert.equal(weekOf('2026-10-26')[0], '2026-10-26'); // Monday
  assert.equal(weekOf('2026-11-01')[6], '2026-11-01'); // Sunday
});

test('dayStatus: one dot per slot active that day; complete only when all are done', () => {
  const lunch = slot('l', { sortOrder: 2, createdAt: at('2026-10-20T12:00:00'), archivedAt: at('2026-10-25T12:00:00') });
  const all = [...slots, lunch];
  assert.deepEqual(dayStatus(all, [], '2026-10-19').slots.map((s) => s.slotId), ['b', 'd']);
  assert.deepEqual(dayStatus(all, [], '2026-10-22').slots.map((s) => s.slotId), ['b', 'd', 'l']);
  const day = dayStatus(all, [brushed('b', '2026-10-22'), brushed('d', '2026-10-22'), brushed('l', '2026-10-22', false)], '2026-10-22');
  assert.deepEqual(day.slots.map((s) => s.done), [true, true, false]);
  assert.equal(day.complete, false, 'an incomplete (early-stopped) session does not count');
});

test('streak: consecutive complete days; an unfinished today does not break it', () => {
  const sessions = [...both('2026-10-28'), ...both('2026-10-29'), ...both('2026-10-30'), brushed('b', '2026-10-31')];
  const summary = summarizeProgress(slots, sessions, at('2026-10-31T09:00:00'));
  assert.equal(summary.currentStreak, 3);
  assert.equal(summary.bestStreak, 3);
  assert.equal(summary.badges.streak, true);

  const done = summarizeProgress(slots, [...sessions, brushed('d', '2026-10-31')], at('2026-10-31T21:00:00'));
  assert.equal(done.currentStreak, 4);
});

test('streak: a missed day resets current but best remembers', () => {
  const sessions = [...both('2026-10-10'), ...both('2026-10-11'), ...both('2026-10-12'), ...both('2026-10-13'), ...both('2026-10-30')];
  const summary = summarizeProgress(slots, sessions, at('2026-10-31T09:00:00'));
  assert.equal(summary.currentStreak, 1);
  assert.equal(summary.bestStreak, 4);
});

test('completion rate counts only slots that are due', () => {
  // Oct 1–30: 30 days × 2 slots, breakfast always done, dinner never. Today 09:00: breakfast done, dinner not due yet.
  const sessions: BrushingSession[] = [];
  for (let day = '2026-10-02'; day <= '2026-10-31'; day = addDays(day, 1)) sessions.push(brushed('b', day));
  const summary = summarizeProgress(slots, sessions, at('2026-10-31T09:00:00'));
  // Due: 29 past days × 2 + today's breakfast (done) = 59; completed: 30.
  assert.equal(summary.completionRate, 30 / 59);
});

test('no slots yet → nothing due, no streak', () => {
  const summary = summarizeProgress([], [], at('2026-10-31T09:00:00'));
  assert.equal(summary.completionRate, null);
  assert.equal(summary.currentStreak, 0);
  assert.equal(summary.week.length, 7);
});

test('badges: first session, and a full Mon–Sun week', () => {
  const sessions: BrushingSession[] = [];
  for (let day = '2026-10-19'; day <= '2026-10-25'; day = addDays(day, 1)) sessions.push(...both(day)); // Mon 19 – Sun 25
  const summary = summarizeProgress(slots, sessions, at('2026-10-31T09:00:00'));
  assert.deepEqual(summary.badges, { firstSession: true, streak: true, weeklyGoal: true });

  const partial = summarizeProgress(slots, sessions.slice(2), at('2026-10-31T09:00:00')); // Monday incomplete
  assert.equal(partial.badges.weeklyGoal, false);
});

test('sessionsNewestFirst orders by start time', () => {
  const a = brushed('b', '2026-10-30');
  const b = brushed('d', '2026-10-31');
  assert.deepEqual(sessionsNewestFirst([a, b]).map((s) => s.id), [b.id, a.id]);
});
