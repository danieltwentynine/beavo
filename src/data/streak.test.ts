/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { BrushingSession } from '@/types';

import { addDays } from './schedule.ts';
import { GIFT_SEED, STREAK_RULES, bestFloorsFromSaved, giftRoll, recentTrail, summarizeStreak, withBestFloor, type StreakSummary } from './streak.ts';

const at = (iso: string) => new Date(iso); // local time
let n = 0;
const session = (date: string, durationSec = 120, completed = durationSec >= 120): BrushingSession => ({
  id: `s${n++}`,
  slotId: 'b',
  date,
  startedAt: at(`${date}T08:00:00`),
  durationSec,
  completed,
});
const evening = (date: string) => at(`${date}T20:00:00`);
const kinds = (s: StreakSummary) => Object.fromEntries(s.trail.map((d) => [d.date, d.kind]));
const range = (from: string, to: string): string[] => {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};

test('v1 constants are the ones in the plan (✱ in the copy sheet)', () => {
  assert.deepEqual(STREAK_RULES, { giftChance: 1 / 7, giftGuaranteeDays: 10, freezeCap: 2, bridgeDays: 3 });
  assert.equal(GIFT_SEED, 'beavo-gift-v1');
});

test('daily: each day with a saved brushing adds 1, several on one day count once', () => {
  const s = summarizeStreak([session('2026-11-24'), session('2026-11-25'), session('2026-11-25'), session('2026-11-26')], evening('2026-11-26'), null);
  assert.equal(s.currentStreak, 3);
  assert.equal(s.bestStreak, 3);
  assert.equal(s.brushedDays, 3);
});

test('an early stop counts as a streak day; a session that never ran does not', () => {
  const early = summarizeStreak([session('2026-11-25'), session('2026-11-26', 3, false)], evening('2026-11-26'), null);
  assert.equal(early.currentStreak, 2);
  const zero = summarizeStreak([session('2026-11-25'), session('2026-11-26', 0, false)], evening('2026-11-26'), null);
  assert.equal(zero.brushedToday, false);
  assert.equal(zero.brushedDays, 1);
});

test('an unfinished today never breaks the trail and is not counted', () => {
  const sessions = [session('2026-11-24'), session('2026-11-25'), session('2026-11-26')];
  const s = summarizeStreak(sessions, at('2026-11-27T07:00:00'), null);
  assert.equal(s.currentStreak, 3);
  assert.equal(s.brushedToday, false);
  const todayEntry = s.trail.at(-1);
  assert.deepEqual(todayEntry, { date: '2026-11-27', kind: 'water', today: true, gift: false });
});

test('Vex 3-day example: brushed Monday, back Friday → Tue–Thu bridged, only real days add', () => {
  // 2026-11-23 is a Monday. No freeze (childId null), as in Vex's example.
  const s = summarizeStreak([session('2026-11-23'), session('2026-11-27')], evening('2026-11-27'), null);
  assert.equal(s.currentStreak, 2);
  assert.equal(s.bestStreak, 2);
  assert.equal(s.brushedDays, 2);
  const k = kinds(s);
  assert.deepEqual([k['2026-11-24'], k['2026-11-25'], k['2026-11-26']], ['bridged', 'bridged', 'bridged']);
  assert.equal(s.newTrailToday, false);
});

test('Vex 4-day example: brushed Monday, back Saturday → a new 1-day trail, record kept', () => {
  const before = [session('2026-11-21'), session('2026-11-22'), session('2026-11-23')]; // Sat, Sun, Mon
  const s = summarizeStreak([...before, session('2026-11-28')], evening('2026-11-28'), null);
  assert.equal(s.currentStreak, 1);
  assert.equal(s.bestStreak, 3);
  assert.equal(s.newTrailToday, true);
  const k = kinds(s);
  assert.deepEqual(range('2026-11-24', '2026-11-27').map((d) => k[d]), ['water', 'water', 'water', 'water']);
});

test('the bridge edges: 3 days pending keeps the trail alive, the 4th ends it', () => {
  const sessions = [session('2026-11-22'), session('2026-11-23')];
  // Thursday morning: Tue and Wed uncovered, still bridgeable.
  assert.equal(summarizeStreak(sessions, at('2026-11-26T07:00:00'), null).currentStreak, 2);
  // Friday morning: Tue–Thu uncovered (3), still bridgeable.
  assert.equal(summarizeStreak(sessions, at('2026-11-27T07:00:00'), null).currentStreak, 2);
  // Saturday morning: Tue–Fri uncovered (4): the trail has ended, quietly.
  const ended = summarizeStreak(sessions, at('2026-11-28T07:00:00'), null);
  assert.equal(ended.currentStreak, 0);
  assert.equal(ended.bestStreak, 2);
});

test('a second session on the bridging day adds no extra credit', () => {
  const s = summarizeStreak([session('2026-11-23'), session('2026-11-27'), session('2026-11-27', 30, false)], evening('2026-11-27'), null);
  assert.equal(s.currentStreak, 2);
});

test('without a child id no freeze is ever granted', () => {
  const sessions = range('2026-09-01', '2026-11-27').map((d) => session(d));
  const s = summarizeStreak(sessions, evening('2026-11-27'), null);
  assert.equal(s.freezesHeld, 0);
  assert.equal(s.trail.some((d) => d.gift), false);
});

/** Brush from `from` until the first gift arrives; returns the gift day. */
function brushUntilGift(childId: string, from: string): { sessions: BrushingSession[]; giftDay: string } {
  const sessions: BrushingSession[] = [];
  for (let d = from; ; d = addDays(d, 1)) {
    sessions.push(session(d));
    const s = summarizeStreak(sessions, evening(d), childId);
    if (s.trail.at(-1)?.gift) return { sessions, giftDay: d };
  }
}

test('freeze: used by itself on the next missed past day, shows as ice and adds 0', () => {
  const { sessions, giftDay } = brushUntilGift('child-A', '2026-11-01');
  const run = sessions.length;
  const missed = addDays(giftDay, 1);
  const back = addDays(giftDay, 2);
  // The day after the miss, before brushing: the ice stone is already there.
  const waiting = summarizeStreak(sessions, at(`${back}T07:00:00`), 'child-A');
  assert.equal(kinds(waiting)[missed], 'frozen');
  assert.equal(waiting.freezesHeld, 0);
  assert.equal(waiting.currentStreak, run);
  const s = summarizeStreak([...sessions, session(back)], evening(back), 'child-A');
  assert.equal(kinds(s)[missed], 'frozen');
  assert.equal(s.currentStreak, run + 1, 'ice adds 0, the brushed day adds 1');
  assert.equal(s.brushedDays, run + 1, 'the dam counts real days only');
});

test('freeze already used + 3 uncovered days → bridged; + 4 → restart (no double credit)', () => {
  const { sessions, giftDay } = brushUntilGift('child-A', '2026-11-01');
  const run = sessions.length;
  const iced = addDays(giftDay, 1);
  const bridgedBack = addDays(giftDay, 5); // iced + 3 uncovered
  const s = summarizeStreak([...sessions, session(bridgedBack)], evening(bridgedBack), 'child-A');
  const k = kinds(s);
  assert.equal(k[iced], 'frozen');
  assert.deepEqual(range(addDays(giftDay, 2), addDays(giftDay, 4)).map((d) => k[d]), ['bridged', 'bridged', 'bridged']);
  assert.equal(s.currentStreak, run + 1);

  const lateBack = addDays(giftDay, 6); // iced + 4 uncovered
  const late = summarizeStreak([...sessions, session(lateBack)], evening(lateBack), 'child-A');
  assert.equal(kinds(late)[iced], 'frozen', 'an ice stone already shown stays');
  assert.equal(late.currentStreak, 1);
  assert.equal(late.bestStreak, run);
  assert.equal(late.newTrailToday, true);
});

test('cap: never more than 2 held; with 2 held no new gift comes', () => {
  const days = range('2026-06-01', '2026-11-27');
  const s = summarizeStreak(days.map((d) => session(d)), evening('2026-11-27'), 'child-A');
  assert.equal(s.freezesHeld, STREAK_RULES.freezeCap);
  assert.equal(s.trail.filter((d) => d.gift).length, STREAK_RULES.freezeCap);
});

test('guarantee: never more than 10 eligible days without a gift, for many children', () => {
  // Brush one day, miss the next: each miss uses the freeze (or is bridged), so every brushed day is eligible.
  const days = range('2026-01-01', '2026-12-31').filter((_, i) => i % 2 === 0);
  let guaranteeUsed = 0;
  for (let c = 0; c < 300; c++) {
    const childId = `child-${c}`;
    const s = summarizeStreak(days.map((d) => session(d)), evening('2026-12-31'), childId);
    let since = 0;
    for (const d of s.trail) {
      if (d.kind !== 'brushed') continue;
      since += 1;
      if (d.gift) {
        if (since === STREAK_RULES.giftGuaranteeDays && giftRoll(childId, d.date) >= STREAK_RULES.giftChance) guaranteeUsed++;
        since = 0;
      }
      assert.ok(since < STREAK_RULES.giftGuaranteeDays, `${childId} waited ${since} days`);
    }
    assert.ok(s.currentStreak > 0, 'brushing every other day keeps one trail');
  }
  assert.ok(guaranteeUsed > 0, 'the guarantee is exercised');
});

test('the draw is about 1 in 7 per eligible day', () => {
  let hits = 0;
  const total = 20_000;
  for (let i = 0; i < total; i++) if (giftRoll(`c${i % 400}`, addDays('2026-01-01', Math.floor(i / 400))) < STREAK_RULES.giftChance) hits++;
  const rate = hits / total;
  assert.ok(Math.abs(rate - 1 / 7) < 0.01, `rate ${rate}`);
});

test('determinism: same history → same trail, in any order, on any device; another child differs', () => {
  const sessions = range('2026-10-01', '2026-11-27').filter((_, i) => i % 5 !== 3).map((d) => session(d));
  const a = summarizeStreak(sessions, evening('2026-11-27'), 'child-A');
  const b = summarizeStreak([...sessions].reverse(), evening('2026-11-27'), 'child-A');
  assert.deepEqual(a, b);
  const giftDays = (id: string) => summarizeStreak(sessions, evening('2026-11-27'), id).trail.filter((d) => d.gift).map((d) => d.date).join();
  const others = Array.from({ length: 10 }, (_, i) => giftDays(`other-${i}`));
  assert.ok(others.some((g) => g !== giftDays('child-A')));
});

test('golden v1 vectors: past outcomes never change', () => {
  assert.equal(giftRoll('child-A', '2026-11-27'), 0.6663569712545723);
  assert.equal(giftRoll('child-A', '2026-11-28'), 0.4455105056986213);
  assert.equal(giftRoll('kq3Zr8VwXy1', '2026-01-01'), 0.47583923558704555);
  assert.equal(giftRoll('local-child', '2030-12-31'), 0.11566798062995076);

  const missing = new Set([5, 6, 12, 13, 14, 20, 21, 22, 23]);
  const sessions = range('2026-11-01', '2026-11-30').filter((d) => !missing.has(Number(d.slice(8)))).map((d) => session(d, 60, false));
  const s = summarizeStreak(sessions, evening('2026-11-30'), 'child-A');
  const code = { brushed: 'b', frozen: 'f', bridged: '=', water: '~' } as const;
  assert.equal(s.trail.map((d) => code[d.kind] + (d.gift ? '*' : '')).join(''), 'bb*bbf=bb*bbbf==bbbbb~~~~b*b*bbbbb');
  assert.deepEqual([s.currentStreak, s.bestStreak, s.freezesHeld, s.brushedDays], [7, 14, 2, 21]);
});

test('a session that syncs late gives the used freeze back', () => {
  const { sessions, giftDay } = brushUntilGift('child-A', '2026-11-01');
  const missed = addDays(giftDay, 1);
  const back = addDays(giftDay, 2);
  const before = summarizeStreak([...sessions, session(back)], evening(back), 'child-A');
  assert.equal(kinds(before)[missed], 'frozen');
  const after = summarizeStreak([...sessions, session(missed), session(back)], evening(back), 'child-A');
  assert.equal(kinds(after)[missed], 'brushed');
  assert.ok(after.freezesHeld > before.freezesHeld || after.freezesHeld === STREAK_RULES.freezeCap, 'the freeze is back in the pocket');
  assert.equal(after.currentStreak, before.currentStreak + 1);
});

test('recentTrail: 7 days ending today, water before the first brushing', () => {
  const s = summarizeStreak([session('2026-11-26')], evening('2026-11-27'), null);
  const recent = recentTrail(s, evening('2026-11-27'));
  assert.equal(recent.length, 7);
  assert.deepEqual(recent.map((d) => d.date), range('2026-11-21', '2026-11-27'));
  assert.deepEqual(recent.map((d) => d.kind), ['water', 'water', 'water', 'water', 'water', 'brushed', 'water']);
  assert.equal(recent[6].today, true);
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

test('DST: days at a missing or doubled hour stay one calendar day each', () => {
  // São Paulo 2018-11-04: midnight did not exist (00:00 → 01:00).
  inZone('America/Sao_Paulo', () => {
    const s = summarizeStreak([session('2018-11-03'), session('2018-11-04'), session('2018-11-05')], evening('2018-11-05'), null);
    assert.deepEqual(s.trail.map((d) => d.date), ['2018-11-03', '2018-11-04', '2018-11-05']);
    assert.equal(s.currentStreak, 3);
  });
  // New York: spring forward 2026-03-08, fall back 2026-11-01.
  inZone('America/New_York', () => {
    for (const day of ['2026-03-08', '2026-11-01']) {
      const days = [addDays(day, -1), day, addDays(day, 1)];
      const s = summarizeStreak(days.map((d) => session(d)), evening(days[2]), null);
      assert.deepEqual(s.trail.map((d) => d.date), days);
      assert.equal(s.currentStreak, 3);
    }
  });
});

test('timezone change: a day skipped by travelling east is bridged; a date "ahead" of today still shows', () => {
  inZone('Asia/Tokyo', () => {
    // Brushed in São Paulo on the 25th and 26th; it is now the 28th in Tokyo.
    const now = new Date('2026-11-27T22:00:00-03:00');
    const s = summarizeStreak([session('2026-11-25'), session('2026-11-26')], now, null);
    assert.equal(s.currentStreak, 2, 'the 27th is pending in the gap, not a break');
    const later = summarizeStreak([session('2026-11-25'), session('2026-11-26'), session('2026-11-28')], now, null);
    assert.equal(later.currentStreak, 3);
    assert.equal(kinds(later)['2026-11-27'], 'bridged');
  });
  inZone('America/Sao_Paulo', () => {
    // A session dated by a device in Tokyo, already the 28th; here it is still the 27th.
    const now = new Date('2026-11-27T20:00:00-03:00');
    const s = summarizeStreak([session('2026-11-26'), session('2026-11-28')], now, null);
    assert.equal(s.trail.at(-1)?.date, '2026-11-28');
    assert.equal(s.brushedDays, 2);
    assert.equal(s.currentStreak, 2);
  });
});

/** A device showing the trail: the record floor it keeps (settingsStore bestTrail). */
function device() {
  let floor = 0;
  return (sessions: BrushingSession[], now: Date, childId: string) => {
    const shown = withBestFloor(summarizeStreak(sessions, now, childId), floor);
    floor = Math.max(floor, shown.bestStreak);
    return shown;
  };
}

test('Vex: a late, back-dated brushing never lowers "Maior trilha" (fixture1, Nov 2026)', () => {
  const nov = (ns: number[]) => ns.map((d) => session(`2026-11-${String(d).padStart(2, '0')}`, 60, false));
  const before = nov([2, 4, 7, 8, 9, 14, 17, 19, 21, 22, 27, 29]);
  const now = evening('2026-11-30');
  // The raw recomputation is what moved: the 3rd shifts the gift schedule.
  assert.equal(summarizeStreak(before, now, 'fixture1').bestStreak, 7);
  assert.equal(summarizeStreak([...before, ...nov([3])], now, 'fixture1').bestStreak, 6);
  // What the child sees keeps the record.
  const show = device();
  assert.equal(show(before, now, 'fixture1').bestStreak, 7);
  assert.equal(show([...before, ...nov([3])], now, 'fixture1').bestStreak, 7);
});

test('the record never goes down over many random late arrivals; current is never above it', () => {
  let seed = 42;
  const rand = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
  for (let t = 0; t < 400; t++) {
    const childId = `fuzz-${t}`;
    const p = 0.3 + rand() * 0.6;
    const days = range('2026-01-01', '2026-04-30').filter(() => rand() < p);
    const now = evening('2026-04-30');
    const show = device();
    let sessions = days.filter(() => rand() < 0.7).map((d) => session(d));
    let last = show(sessions, now, childId).bestStreak;
    for (const d of days) {
      if (sessions.some((s) => s.date === d)) continue;
      sessions = [...sessions, session(d)]; // arrives late, back-dated
      const shown = show(sessions, now, childId);
      assert.ok(shown.bestStreak >= last, `${childId} +${d}: ${last} → ${shown.bestStreak}`);
      assert.ok(shown.currentStreak <= shown.bestStreak);
      last = shown.bestStreak;
    }
  }
});

test('record floors from storage are untrusted: non-negative integers only', () => {
  assert.deepEqual(bestFloorsFromSaved({ a: 7, b: -1, c: 2.5, d: '9', e: 3 }), { a: 7, e: 3 });
  assert.deepEqual(bestFloorsFromSaved(null), {});
  const s = summarizeStreak([session('2026-11-26'), session('2026-11-27')], evening('2026-11-27'), null);
  assert.equal(withBestFloor(s, undefined).bestStreak, 2);
  assert.equal(withBestFloor(s, 9).bestStreak, 9);
  assert.equal(withBestFloor(s, 1), s, 'no change when the computed record is higher');
});
