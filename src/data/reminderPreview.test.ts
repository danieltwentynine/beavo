import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { BrushingSlot } from '@/types';

import { groupReminderPreview } from './reminderPreview.ts';
import { DEFAULT_QUIET_HOURS, planReminders } from './reminders.ts';

const slot = (id: string, windowStart: string, windowEnd: string): BrushingSlot => ({
  id, label: id, icon: 'sun', mealType: 'custom', windowStart, windowEnd, sortOrder: 0,
  createdAt: new Date(2026, 10, 1),
});

test('offer preview shows the device plan with sibling times, quiet hours and the daily cap', () => {
  const plan = planReminders({
    enabled: true,
    now: new Date(2026, 10, 27, 8),
    zone: 'local',
    prefs: {},
    quiet: DEFAULT_QUIET_HOURS,
    horizonDays: 2,
    children: [
      { childId: 'ana', slots: [slot('b', '06:00', '09:00'), slot('d', '18:00', '21:00')], brushed: new Set() },
      { childId: 'leo', slots: [
        slot('morning', '07:15', '09:00'), slot('lunch', '12:00', '14:00'), slot('quiet', '22:00', '23:00'),
      ], brushed: new Set(['2026-11-27|lunch']) },
    ],
  });

  assert.deepEqual(groupReminderPreview(plan).map(({ day, times }) => ({ day, times })), [
    { day: '2026-11-27', times: ['18:00'] },
    { day: '2026-11-28', times: ['07:00', '12:00', '18:00'] },
  ]);
});

test('an empty planner result has no preview dates', () => {
  assert.deepEqual(groupReminderPreview([]), []);
});


test('the offer preview keeps tomorrow when today has already used the device budget', () => {
  const plan = planReminders({
    enabled: true,
    now: new Date(2026, 10, 27, 13),
    zone: 'local',
    prefs: {},
    quiet: DEFAULT_QUIET_HOURS,
    horizonDays: 2,
    log: [7, 9, 11].map((h) => new Date(2026, 10, 27, h).getTime()), // instants already past today
    children: [{ childId: 'ana', slots: [slot('d', '18:00', '21:00')], brushed: new Set() }],
  });

  assert.deepEqual(groupReminderPreview(plan).map(({ day, times }) => ({ day, times })), [
    { day: '2026-11-28', times: ['18:00'] },
  ]);
});

test('the preview displays the actual fire time when the clock normalizes a planned time', () => {
  const fireAt = new Date(2026, 2, 8, 3, 30);
  assert.deepEqual(groupReminderPreview([{ id: 'reminder', day: '2026-03-08', time: '02:30', fireAt }])[0]?.times, ['03:30']);
});
