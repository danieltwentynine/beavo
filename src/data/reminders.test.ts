/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { BrushingSlot } from '@/types';

import {
  DEFAULT_QUIET_HOURS,
  REMINDER_ID_PREFIX,
  applyReminderPlan,
  capTimes,
  clearReminders,
  defaultReminderSettings,
  defaultReminderTime,
  diffReminders,
  enableAfterGate,
  inQuietHours,
  planReminders,
  prefKey,
  prunePrefs,
  reminderLogFromSaved,
  reminderSettingsForOwner,
  reminderSettingsFromSaved,
  nextReminderLog,
  dismissDelivered,
  withPendingFlag,
  reminderTimeFor,
  shouldOfferReminders,
  slotReminderRows,
  type NotificationPort,
  type PermissionState,
  type PlanInput,
  type PlannedReminder,
} from './reminders.ts';

const at = (iso: string) => new Date(iso); // local time
const slot = (id: string, windowStart: string, windowEnd: string, over: Partial<BrushingSlot> = {}): BrushingSlot => ({
  id,
  label: id,
  icon: 'sun',
  mealType: 'custom',
  windowStart,
  windowEnd,
  sortOrder: 0,
  createdAt: at('2026-10-01T08:00:00'),
  ...over,
});
// The default routine (schedule.ts defaultSlots).
const breakfast = slot('b', '06:00', '10:00');
const lunch = slot('l', '11:00', '15:00', { sortOrder: 1 });
const dinner = slot('d', '18:00', '22:00', { sortOrder: 2 });
const routine = [breakfast, lunch, dinner];
const kid = (childId: string, slots = routine, brushed: string[] = []) => ({ childId, slots, brushed: new Set(brushed) });
const input = (over: Partial<PlanInput> = {}): PlanInput => ({
  enabled: true,
  children: [kid('ana')],
  prefs: {},
  quiet: DEFAULT_QUIET_HOURS,
  now: at('2026-11-27T05:00:00'),
  zone: 'America/Sao_Paulo',
  ...over,
});
const times = (plan: PlannedReminder[], day: string) => plan.filter((p) => p.day === day).map((p) => p.time);

test('quiet hours wrap midnight; equal start and end means none', () => {
  assert.equal(inQuietHours('21:00', DEFAULT_QUIET_HOURS), true);
  assert.equal(inQuietHours('23:59', DEFAULT_QUIET_HOURS), true);
  assert.equal(inQuietHours('06:59', DEFAULT_QUIET_HOURS), true);
  assert.equal(inQuietHours('07:00', DEFAULT_QUIET_HOURS), false);
  assert.equal(inQuietHours('20:59', DEFAULT_QUIET_HOURS), false);
  assert.equal(inQuietHours('13:00', { start: '12:00', end: '14:00' }), true);
  assert.equal(inQuietHours('03:00', { start: '00:00', end: '00:00' }), false);
});

test('default time: the window start, moved to the end of quiet hours when needed', () => {
  assert.equal(defaultReminderTime(breakfast, DEFAULT_QUIET_HOURS), '07:00');
  assert.equal(defaultReminderTime(lunch, DEFAULT_QUIET_HOURS), '11:00');
  assert.equal(defaultReminderTime(dinner, DEFAULT_QUIET_HOURS), '18:00');
  assert.equal(defaultReminderTime(slot('x', '22:00', '23:00'), DEFAULT_QUIET_HOURS), null, 'a fully quiet window has none');
});

test('a chosen time is kept inside the slot window and dropped in quiet hours', () => {
  assert.equal(reminderTimeFor(dinner, { on: true, time: '19:30' }, DEFAULT_QUIET_HOURS), '19:30');
  assert.equal(reminderTimeFor(dinner, { on: true, time: '17:00' }, DEFAULT_QUIET_HOURS), '18:00');
  assert.equal(reminderTimeFor(dinner, { on: true, time: '21:30' }, DEFAULT_QUIET_HOURS), null, '21:30 is quiet');
  assert.equal(reminderTimeFor(dinner, { on: false, time: '19:30' }, DEFAULT_QUIET_HOURS), null);
  assert.equal(reminderTimeFor(dinner, { on: true, time: 'nope' }, DEFAULT_QUIET_HOURS), '18:00');
});

test('off until enabled: nothing is planned', () => {
  assert.deepEqual(planReminders(input({ enabled: false })), []);
});

test('one reminder per slot per day, 7 days ahead, soonest first', () => {
  const plan = planReminders(input());
  assert.equal(plan.length, 21);
  assert.deepEqual(times(plan, '2026-11-27'), ['07:00', '11:00', '18:00']);
  assert.equal(plan.at(-1)?.day, '2026-12-03');
  assert.deepEqual(plan.map((p) => p.fireAt.getTime()), [...plan].map((p) => p.fireAt.getTime()).sort((a, b) => a - b));
  assert.equal(plan[0].fireAt.getTime(), at('2026-11-27T07:00:00').getTime());
});

test('times already past today are not planned', () => {
  const plan = planReminders(input({ now: at('2026-11-27T12:00:00') }));
  assert.deepEqual(times(plan, '2026-11-27'), ['18:00']);
});

test('a slot already brushed today (known on this device) is skipped', () => {
  const plan = planReminders(input({ children: [kid('ana', routine, ['2026-11-27|b'])] }));
  assert.deepEqual(times(plan, '2026-11-27'), ['11:00', '18:00']);
  assert.deepEqual(times(plan, '2026-11-28'), ['07:00', '11:00', '18:00']);
});

test('archived slots and switched-off slots get no reminder', () => {
  const archived = { ...lunch, archivedAt: at('2026-11-20T10:00:00') };
  const plan = planReminders(input({ children: [kid('ana', [breakfast, archived, dinner])], prefs: { [prefKey('ana', 'd')]: { on: false, time: null } } }));
  assert.deepEqual(times(plan, '2026-11-28'), ['07:00']);
});

test('siblings at the same minute share one reminder', () => {
  const plan = planReminders(input({ children: [kid('ana'), kid('leo')] }));
  assert.deepEqual(times(plan, '2026-11-28'), ['07:00', '11:00', '18:00']);
});

test('at most 3 a day for the device, even when siblings have different times', () => {
  const leo = kid('leo', [slot('b2', '07:15', '09:00'), slot('d2', '19:30', '21:00', { sortOrder: 1 })]);
  const plan = planReminders(input({ children: [kid('ana'), leo] }));
  // 07:00, 07:15, 11:00, 18:00, 19:30 → the closest neighbours merge into the earlier time.
  assert.deepEqual(times(plan, '2026-11-28'), ['07:00', '11:00', '18:00']);
  const perDay = new Map<string, number>();
  for (const p of plan) perDay.set(p.day, (perDay.get(p.day) ?? 0) + 1);
  assert.ok([...perDay.values()].every((count) => count <= 3));
});

test('capTimes merges the closest pair first and is deterministic', () => {
  assert.deepEqual(capTimes(['07:00', '07:10', '12:00', '18:00']), ['07:00', '12:00', '18:00']);
  assert.deepEqual(capTimes(['18:00', '07:00', '12:00', '12:20', '19:00']), ['07:00', '12:00', '18:00']);
  assert.deepEqual(capTimes(['07:00', '07:00']), ['07:00']);
});

test('ids are stable (re-planning changes nothing) and carry the zone (a zone change replaces all)', () => {
  const a = planReminders(input());
  const b = planReminders(input({ now: at('2026-11-27T06:00:00') }));
  assert.deepEqual(diffReminders(a.map((p) => p.id), b), { cancel: [], add: [] });
  const moved = planReminders(input({ zone: 'Europe/Lisbon' }));
  const diff = diffReminders(a.map((p) => p.id), moved);
  assert.equal(diff.cancel.length, a.length);
  assert.equal(diff.add.length, moved.length);
  assert.ok(a.every((p) => p.id.startsWith(REMINDER_ID_PREFIX)));
});

test('the 7-day horizon stays far under the iOS limit of 64 pending', () => {
  const many = Array.from({ length: 5 }, (_, i) => kid(`c${i}`));
  assert.ok(planReminders(input({ children: many })).length <= 7 * 3);
});

/** Run `fn` with the process in another timezone (Node re-reads TZ when it changes). */
function inZone(zone: string, fn: () => void): void {
  const saved = process.env.TZ;
  process.env.TZ = zone;
  try {
    fn();
  } finally {
    if (saved === undefined) delete process.env.TZ;
    else process.env.TZ = saved;
  }
}

test('DST: reminders keep their wall-clock time across spring-forward and fall-back', () => {
  inZone('America/New_York', () => {
    for (const day of ['2026-03-08', '2026-11-01']) {
      const plan = planReminders(input({ now: at(`${day}T00:30:00`), zone: 'America/New_York', horizonDays: 2 }));
      for (const p of plan) {
        assert.equal(p.fireAt.getHours() * 60 + p.fireAt.getMinutes(), Number(p.time.slice(0, 2)) * 60 + Number(p.time.slice(3)));
      }
      assert.deepEqual(times(plan, day), ['07:00', '11:00', '18:00']);
    }
  });
  inZone('America/Sao_Paulo', () => {
    const plan = planReminders(input({ now: at('2026-11-27T05:00:00'), horizonDays: 1 }));
    assert.equal(plan[0].fireAt.toISOString(), '2026-11-27T10:00:00.000Z', 'Brazil: UTC−3, no DST');
  });
});

/** A fake notification system that records what it was asked. `failCancels` makes the next n cancellations reject. */
function fakePort(initial: string[] = []): NotificationPort & { ids: Set<string>; dismissed: number; failCancels: number; cancelAllCalls: number } {
  const ids = new Set(initial);
  return {
    ids,
    dismissed: 0,
    failCancels: 0,
    cancelAllCalls: 0,
    scheduledIds: async () => [...ids],
    schedule: async (r) => void ids.add(r.id),
    async cancel(id) {
      if (this.failCancels > 0) {
        this.failCancels--;
        throw new Error('temporary');
      }
      ids.delete(id);
    },
    async cancelAll() {
      this.cancelAllCalls++;
      ids.clear();
    },
    async dismissDelivered() {
      this.dismissed++;
    },
  };
}

test('applying a plan cancels and adds only our reminders; applying it again is a no-op', async () => {
  const port = fakePort(['someone-else', `${REMINDER_ID_PREFIX}old`]);
  const plan = planReminders(input());
  assert.deepEqual(await applyReminderPlan(port, plan), { added: 21, cancelled: 1, ok: true });
  assert.ok(port.ids.has('someone-else'));
  assert.deepEqual(await applyReminderPlan(port, plan), { added: 0, cancelled: 0, ok: true });
});

test('clearing (sign-out, erase, deletion) cancels every pending reminder and the delivered ones', async () => {
  const port = fakePort();
  await applyReminderPlan(port, planReminders(input()));
  assert.equal(await clearReminders(port), true);
  assert.deepEqual([...port.ids], []);
  assert.equal(port.dismissed, 1);
});

test('Vex: one failed cancellation never leaves reminders behind (retry, then cancel-all; failure is reported)', async () => {
  const port = fakePort();
  await applyReminderPlan(port, planReminders(input({ horizonDays: 1 })));
  assert.equal(port.ids.size, 3);
  port.failCancels = 1;
  assert.equal(await clearReminders(port), true, 'the others are still cancelled, then cancel-all takes the rest');
  assert.equal(port.ids.size, 0);
  assert.equal(port.dismissed, 1, 'delivered ones are cleared even after a failure');

  // A system that keeps failing: reported, so the caller keeps the clean-up pending and retries.
  const stuck = fakePort();
  await applyReminderPlan(stuck, planReminders(input({ horizonDays: 1 })));
  stuck.failCancels = 99;
  stuck.cancelAll = async () => {
    throw new Error('still failing');
  };
  assert.equal(await clearReminders(stuck), false);
  // …and recovers on the retry.
  stuck.failCancels = 0;
  assert.equal(await clearReminders(stuck), true);
  assert.equal(stuck.ids.size, 0);
});

test('a failed cancellation stops the plan from scheduling on top (no doubles)', async () => {
  const port = fakePort();
  await applyReminderPlan(port, planReminders(input({ horizonDays: 1 })));
  port.failCancels = 1;
  const moved = planReminders(input({ horizonDays: 1, zone: 'Europe/Lisbon' }));
  const result = await applyReminderPlan(port, moved);
  assert.equal(result.ok, false);
  assert.equal(result.added, 0);
  assert.ok(port.ids.size <= 3);
});

test('Vex: the 3-a-day cap holds across re-plans (times already past count)', async () => {
  const morning = at('2026-11-27T05:00:00');
  const early = [slot('a', '07:00', '08:00'), slot('b', '09:00', '10:00', { sortOrder: 1 }), slot('c', '11:00', '11:30', { sortOrder: 2 })];
  const first = planReminders(input({ now: morning, children: [kid('ana', early)], horizonDays: 1 }));
  assert.deepEqual(times(first, '2026-11-27'), ['07:00', '09:00', '11:00']);
  const log = nextReminderLog([], first, morning);

  // Noon: the routine is edited to afternoon slots. Without the log the planner would add 13:00, 15:00, 17:00.
  const noon = at('2026-11-27T12:00:00');
  const late = [slot('a', '13:00', '14:00'), slot('b', '15:00', '16:00', { sortOrder: 1 }), slot('c', '17:00', '18:00', { sortOrder: 2 })];
  assert.equal(times(planReminders(input({ now: noon, children: [kid('ana', late)], horizonDays: 1 })), '2026-11-27').length, 3);
  const replanned = planReminders(input({ now: noon, children: [kid('ana', late)], log, horizonDays: 2 }));
  assert.deepEqual(times(replanned, '2026-11-27'), [], 'three already past today: none more');
  assert.deepEqual(times(replanned, '2026-11-28'), ['13:00', '15:00', '17:00'], 'tomorrow has its full budget');

  // Two past, one budget left; a sibling's times are merged into it.
  const twoPast = nextReminderLog([], first.slice(0, 2), morning);
  const ten = at('2026-11-27T10:00:00');
  const after = planReminders(input({ now: ten, children: [kid('ana', late), kid('leo', [slot('x', '19:00', '20:00')])], log: twoPast, horizonDays: 1 }));
  assert.equal(after.length, 1);
});

test('the log keeps past instants of the last 2 days, drops cancelled future ones', () => {
  const now = at('2026-11-27T10:00:00');
  const ms = (iso: string) => at(iso).getTime();
  const log = [ms('2026-11-24T07:00:00'), ms('2026-11-26T07:00:00'), ms('2026-11-27T07:00:00'), ms('2026-11-27T11:00:00')];
  const plan = planReminders(input({ now, horizonDays: 2 }));
  assert.deepEqual(nextReminderLog(log, plan, now), [
    ms('2026-11-26T07:00:00'), ms('2026-11-27T07:00:00'), ms('2026-11-27T11:00:00'), ms('2026-11-27T18:00:00'),
    ms('2026-11-28T07:00:00'), ms('2026-11-28T11:00:00'), ms('2026-11-28T18:00:00'),
  ]);
  assert.deepEqual(nextReminderLog(log, [], now), [ms('2026-11-26T07:00:00'), ms('2026-11-27T07:00:00')], '11:00 was cancelled before it fired; 3 days ago is gone');
  assert.deepEqual(reminderLogFromSaved([...log, 'x', 1.5, ms('2027-01-01T00:00:00')], now), log.slice(1));
  assert.deepEqual(reminderLogFromSaved({ '2026-11-27': ['07:00'] }, now), [], 'the older day→times format reads as empty');
});

test('Vex round 2: travelling west cannot free budget — instants are counted per local day where the phone is now', () => {
  let log: number[] = [];
  inZone('America/New_York', () => {
    // 07, 09, 11 New York time, all delivered.
    const early = [slot('a', '07:00', '08:00'), slot('b', '09:00', '10:00', { sortOrder: 1 }), slot('c', '11:00', '11:30', { sortOrder: 2 })];
    const morning = at('2026-11-27T05:00:00');
    const plan = planReminders(input({ now: morning, zone: 'America/New_York', children: [kid('ana', early)], horizonDays: 1 }));
    assert.equal(plan.length, 3);
    log = nextReminderLog([], plan, morning);
  });
  inZone('America/Chicago', () => {
    // 10:05 in Chicago = 11:05 in New York: all three fired. 11:00 local "is still ahead" as a wall-clock time, but not as an instant.
    const now = at('2026-11-27T10:05:00');
    const late = [slot('d', '13:00', '14:00')];
    const plan = planReminders(input({ now, zone: 'America/Chicago', children: [kid('ana', late)], log, horizonDays: 2 }));
    assert.deepEqual(times(plan, '2026-11-27'), [], 'no 4th reminder today');
    assert.deepEqual(times(plan, '2026-11-28'), ['13:00']);
  });
});

test('Vex round 2: a failed clean-up stays pending and is retried until it works', async () => {
  let pending = false;
  const setPending = (p: boolean) => void (pending = p);
  const port = fakePort();
  let failDismiss = true;
  port.dismissDelivered = async () => {
    if (failDismiss) throw new Error('native failure');
    port.dismissed++;
  };
  assert.equal(await withPendingFlag(() => dismissDelivered(port), setPending), false);
  assert.equal(pending, true, 'kept pending: retried at the next launch or foreground');
  failDismiss = false;
  assert.equal(await withPendingFlag(() => dismissDelivered(port), setPending), true);
  assert.equal(pending, false);
  assert.equal(port.dismissed, 1);
  // A clean-up that throws counts as failed, never as done.
  assert.equal(await withPendingFlag(async () => { throw new Error('x'); }, setPending), false);
  assert.equal(pending, true);
});

test('Vex: a time moved by DST is re-checked in the real local time (quiet hours, window)', () => {
  inZone('America/New_York', () => {
    // 2026-03-08: 02:00–03:00 doesn't exist; a 02:30 reminder would really fire at 03:30.
    const night = [slot('n', '02:00', '05:00')];
    const quiet = { start: '03:00', end: '07:00' };
    const plan = planReminders(input({ now: at('2026-03-07T20:00:00'), zone: 'America/New_York', quiet, children: [kid('ana', night)], prefs: { [prefKey('ana', 'n')]: { on: true, time: '02:30' } }, horizonDays: 3 }));
    assert.deepEqual(plan.map((p) => p.day), ['2026-03-09'], 'none on the DST day (02:30 → 03:30 is quiet); the next day is normal');
    assert.ok(plan.every((p) => !inQuietHours(`${String(p.fireAt.getHours()).padStart(2, '0')}:${String(p.fireAt.getMinutes()).padStart(2, '0')}`, quiet)));

    // Outside quiet hours but pushed past the slot window: dropped too.
    const narrow = [slot('n', '02:00', '02:45')];
    const plan2 = planReminders(input({ now: at('2026-03-07T20:00:00'), zone: 'America/New_York', quiet: { start: '00:00', end: '00:00' }, children: [kid('ana', narrow)], prefs: { [prefKey('ana', 'n')]: { on: true, time: '02:30' } }, horizonDays: 3 }));
    assert.deepEqual(plan2.map((p) => p.day), ['2026-03-09']);
  });
});

test('Vex: "Agora não" survives sign-out, restart and sign-in on this device; reminders stay off', () => {
  const declined = { ...defaultReminderSettings('u1'), offer: 'done' as const, enabled: true, prefs: { 'a|b': { on: false, time: null } } };
  const signedOut = reminderSettingsForOwner(declined, null);
  assert.deepEqual(signedOut, { ...defaultReminderSettings(null), offer: 'done' });
  // Restart: what was saved is read back.
  const restarted = reminderSettingsFromSaved(JSON.parse(JSON.stringify(signedOut)));
  const signedIn = reminderSettingsForOwner(restarted, 'u1');
  assert.equal(signedIn.offer, 'done');
  assert.equal(signedIn.enabled, false);
  assert.deepEqual(signedIn.prefs, {});
  assert.equal(shouldOfferReminders({ offer: signedIn.offer, enabled: signedIn.enabled, ownerId: 'u1', hasChild: true, kidMode: false }), false);
  // Another account on the same device isn't offered either (device-wide answer, no account id kept).
  assert.equal(reminderSettingsForOwner(signedOut, 'u2').offer, 'done');
  assert.equal(reminderSettingsForOwner(defaultReminderSettings('u1'), 'u2').offer, 'unseen');
});

test('a deleted child: its reminders go with the next plan, and its prefs are pruned', async () => {
  const port = fakePort();
  const leo = kid('leo', [slot('b2', '08:30', '09:00')]);
  const ana = kid('ana', [dinner]);
  await applyReminderPlan(port, planReminders(input({ children: [ana, leo] })));
  assert.ok([...port.ids].some((id) => id.endsWith('T08:30')));
  await applyReminderPlan(port, planReminders(input({ children: [ana] })));
  assert.ok(![...port.ids].some((id) => id.endsWith('T08:30')));
  const prefs = { [prefKey('ana', 'b')]: { on: true, time: null }, [prefKey('leo', 'b2')]: { on: false, time: null } };
  assert.deepEqual(Object.keys(prunePrefs(prefs, ['ana'])), [prefKey('ana', 'b')]);
});

test('saved settings are untrusted: malformed values fall back to off', () => {
  assert.deepEqual(reminderSettingsFromSaved(null), defaultReminderSettings());
  assert.deepEqual(reminderSettingsFromSaved({ enabled: 'yes', quiet: { start: '25:00', end: '07:00' }, offer: 'maybe', prefs: { bad: 1, 'a|b': { on: true, time: '9:00' } } }), {
    ownerId: null,
    enabled: false,
    quiet: DEFAULT_QUIET_HOURS,
    prefs: { 'a|b': { on: true, time: null } },
    offer: 'unseen',
  });
  const good = { ownerId: 'u1', enabled: true, quiet: { start: '22:00', end: '06:30' }, prefs: { 'a|b': { on: false, time: '08:15' } }, offer: 'done' };
  assert.deepEqual(reminderSettingsFromSaved(good), good);
});

test('the offer: once, to an adult with a child, never in kid mode', () => {
  const base = { offer: 'unseen', enabled: false, ownerId: 'u1', hasChild: true, kidMode: false } as const;
  assert.equal(shouldOfferReminders(base), true);
  assert.equal(shouldOfferReminders({ ...base, kidMode: true }), false, 'kid mode waits for an adult');
  assert.equal(shouldOfferReminders({ ...base, offer: 'done' }), false, 'answered: never again by itself');
  assert.equal(shouldOfferReminders({ ...base, enabled: true }), false);
  assert.equal(shouldOfferReminders({ ...base, ownerId: null }), false);
  assert.equal(shouldOfferReminders({ ...base, hasChild: false }), false);
});

function enableDeps(current: PermissionState, answer: PermissionState) {
  const calls = { requested: 0, enabled: null as boolean | null, offerDone: false };
  return {
    calls,
    deps: {
      permission: async () => current,
      request: async () => {
        calls.requested++;
        return answer;
      },
      setEnabled: (on: boolean) => void (calls.enabled = on),
      markOfferDone: () => void (calls.offerDone = true),
    },
  };
}

test('enabling after the gate: asks the system only when unanswered; a refusal keeps it off', async () => {
  const asked = enableDeps('undetermined', 'granted');
  assert.equal(await enableAfterGate(asked.deps), 'on');
  assert.deepEqual(asked.calls, { requested: 1, enabled: true, offerDone: true });

  const already = enableDeps('granted', 'denied');
  assert.equal(await enableAfterGate(already.deps), 'on');
  assert.equal(already.calls.requested, 0, 'no second prompt when already granted');

  const refused = enableDeps('undetermined', 'denied');
  assert.equal(await enableAfterGate(refused.deps), 'denied');
  assert.deepEqual(refused.calls, { requested: 1, enabled: false, offerDone: true });

  const blocked = enableDeps('denied', 'granted');
  assert.equal(await enableAfterGate(blocked.deps), 'denied');
  assert.equal(blocked.calls.requested, 0, 'a blocked permission is never re-asked; Settings is the way');
});

test('rows for Adultos → Lembretes show the real time and a quiet-hours block', () => {
  const settings = { prefs: { [prefKey('ana', 'd')]: { on: true, time: '21:30' } }, quiet: DEFAULT_QUIET_HOURS };
  const rows = slotReminderRows('ana', routine, settings);
  assert.deepEqual(rows.map((r) => [r.slotId, r.on, r.time, r.quietBlocked]), [
    ['b', true, '07:00', false],
    ['l', true, '11:00', false],
    ['d', true, null, true],
  ]);
});

test('enabling: stillAllowed is re-checked before the prompt and after it; a change saves nothing', async () => {
  const before = enableDeps('undetermined', 'granted');
  assert.equal(await enableAfterGate({ ...before.deps, stillAllowed: () => false }), 'cancelled');
  assert.deepEqual(before.calls, { requested: 0, enabled: null, offerDone: false });

  // Another profile took over while the system prompt was open.
  const during = enableDeps('undetermined', 'granted');
  let allowed = true;
  const request = during.deps.request;
  during.deps.request = async () => {
    const answer = await request();
    allowed = false;
    return answer;
  };
  assert.equal(await enableAfterGate({ ...during.deps, stillAllowed: () => allowed }), 'cancelled');
  assert.deepEqual(during.calls, { requested: 1, enabled: null, offerDone: false });

  const ok = enableDeps('granted', 'granted');
  assert.equal(await enableAfterGate({ ...ok.deps, stillAllowed: () => true }), 'on');
});
