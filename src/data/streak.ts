import type { BrushingSession } from '@/types';

import { addDays, localDate } from './schedule.ts';

/**
 * The child's daily streak ("trilha de pedrinhas"), derived from the saved
 * sessions only: nothing about it is stored, synced, backed up or deleted on
 * its own (owner decisions, 2026-11-27; docs in
 * OpenBot/Shared/beavo-reminders/PLANO.md v3 and vex.md v3). Pure, so
 * `node --test` runs it.
 *
 * - A STREAK DAY is a local date with at least one saved session that ran
 *   (durationSec > 0), early stops included: the same days the dam counts.
 *   Several sessions on one date count once. Each streak day adds +1.
 * - FREEZE ("gelinho"): after a streak day the child may receive one, by a
 *   seeded draw on (childId, date) — about 1 in 7, guaranteed within 10
 *   eligible days, at most 2 held. A held freeze is used by itself on a past
 *   day without brushing while the trail is alive; that day shows as an ice
 *   stone and adds 0. Freezes never expire. Silent: the child UI must not
 *   show the draw, the gift or how many are held (Vex v2 blocker).
 * - BRIDGE (repair "C"): the next streak day joins the trail across up to
 *   3 whole local days without brushing that no freeze covered; those days
 *   add 0. A longer gap starts a new trail at 1; bestStreak keeps the record.
 * - TODAY without brushing is pending: it never breaks the trail, never uses
 *   a freeze and is not counted in a gap.
 * - The dam (`brushedDays`) counts real streak days only, never ice or bridge.
 *
 * These rules are frozen: changing a constant or the seed rewrites every
 * child's past trail. A future rule change needs a cutover date (old days keep
 * v1); the golden tests in streak.test.ts fail if v1 drifts.
 */

/** ✱ Final v1 constants (Quill's sheet, PLANO v3). */
export const STREAK_RULES = {
  /** Chance of a freeze on an eligible streak day. */
  giftChance: 1 / 7,
  /** The Nth eligible streak day without a gift always brings one. */
  giftGuaranteeDays: 10,
  /** Most freezes held at once; at the cap no gift is drawn and the guarantee waits. */
  freezeCap: 2,
  /** Longest run of uncovered days the next streak day still bridges. */
  bridgeDays: 3,
} as const;

/** Seed salt for the v1 draw. Never change it (see above). */
export const GIFT_SEED = 'beavo-gift-v1';

export type TrailDayKind = 'brushed' | 'frozen' | 'bridged' | 'water';

export interface TrailDay {
  date: string;
  /** brushed: a saved brushing · frozen: an ice stone (rest day) · bridged: joined by the next brushing · water: nothing (also today before brushing). */
  kind: TrailDayKind;
  today: boolean;
  /** A freeze was granted after this day's brushing. ADULT/TEST ONLY: never show it to the child. */
  gift: boolean;
}

export interface StreakSummary {
  /** Streak days in the trail that is still alive (0 once a gap exceeded the bridge). */
  currentStreak: number;
  /** Longest trail ever, in streak days. Never decreases while sessions only get added. */
  bestStreak: number;
  /** Distinct streak days in all history (the dam). */
  brushedDays: number;
  brushedToday: boolean;
  /** Today's brushing started a new trail after an earlier one ended ("Uma trilha nova começa hoje"). */
  newTrailToday: boolean;
  /** ADULT/TEST ONLY: freezes held now. The child UI shows no stock (PLANO v2). */
  freezesHeld: number;
  /** One entry per day from the first streak day to today (or the latest dated session), oldest first. */
  trail: TrailDay[];
}

/** The local dates the child brushed: any saved session that ran. */
export function streakDays(sessions: readonly BrushingSession[]): Set<string> {
  return new Set(sessions.filter((s) => s.durationSec > 0).map((s) => s.date));
}

/** 32-bit FNV-1a over UTF-16 code units, then the murmur3 finalizer for an even spread. */
function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** The v1 draw for one child and day, in [0, 1). Same answer on every device, forever. */
export function giftRoll(childId: string, day: string): number {
  return hash32(`${GIFT_SEED}|${childId}|${day}`) / 2 ** 32;
}

/**
 * Walk the child's history once, oldest day first. `childId` seeds the freeze
 * draw; null turns freezes off (no child known).
 */
export function summarizeStreak(sessions: readonly BrushingSession[], now: Date, childId: string | null): StreakSummary {
  const today = localDate(now);
  const days = streakDays(sessions);
  const empty: StreakSummary = {
    currentStreak: 0, bestStreak: 0, brushedDays: 0, brushedToday: false, newTrailToday: false, freezesHeld: 0, trail: [],
  };
  if (days.size === 0) return empty;

  const sorted = [...days].sort();
  const start = sorted[0];
  // A session dated after today (clock or timezone change) still shows.
  const end = sorted[sorted.length - 1] > today ? sorted[sorted.length - 1] : today;

  const trail: TrailDay[] = [];
  let run = 0;
  let best = 0;
  let alive = false;
  let held = 0;
  let sinceGift = 0;
  let trails = 0;
  let gap: TrailDay[] = []; // uncovered past days since the last kept day

  for (let day = start; day <= end; day = addDays(day, 1)) {
    const entry: TrailDay = { date: day, kind: 'water', today: day === today, gift: false };
    trail.push(entry);
    if (days.has(day)) {
      if (alive && gap.length <= STREAK_RULES.bridgeDays) {
        for (const g of gap) g.kind = 'bridged';
        run += 1;
      } else {
        run = 1;
        trails += 1;
      }
      gap = [];
      alive = true;
      best = Math.max(best, run);
      entry.kind = 'brushed';
      if (childId !== null && held < STREAK_RULES.freezeCap) {
        sinceGift += 1;
        if (sinceGift >= STREAK_RULES.giftGuaranteeDays || giftRoll(childId, day) < STREAK_RULES.giftChance) {
          held += 1;
          sinceGift = 0;
          entry.gift = true;
        }
      }
    } else if (day >= today) {
      // Today (or later) without brushing: pending, nothing happens yet.
    } else if (alive && held > 0) {
      held -= 1;
      entry.kind = 'frozen';
    } else if (alive) {
      gap.push(entry);
      if (gap.length > STREAK_RULES.bridgeDays) {
        alive = false;
        gap = [];
      }
    }
  }

  const brushedToday = days.has(today);
  return {
    currentStreak: alive ? run : 0,
    bestStreak: best,
    brushedDays: days.size,
    brushedToday,
    newTrailToday: brushedToday && run === 1 && trails > 1,
    freezesHeld: held,
    trail,
  };
}

/**
 * "Maior trilha" never goes down (Vex build review). Freezes are a shared
 * pool spent in date order, so a brushing that syncs late (back-dated) can move
 * a gift or a freeze and, rarely, shorten a past trail in the recomputation:
 * fuzzing the v1 rules, about 0.2% of random late arrivals did. No rule change
 * removes that while keeping the owner's freeze design, so the record is
 * floored by the highest value this device has already shown for the child
 * (`stores/settingsStore` bestTrail, device-only, cleared with the owner).
 * A new session can then only raise it. `currentStreak` is never above it.
 */
export function withBestFloor(summary: StreakSummary, floor: number | undefined): StreakSummary {
  const best = Math.max(summary.bestStreak, summary.currentStreak, Number.isFinite(floor) ? Number(floor) : 0);
  return best === summary.bestStreak ? summary : { ...summary, bestStreak: best };
}

/** Saved per-device record floors (untrusted storage): non-negative integers by child id only. */
export function bestFloorsFromSaved(saved: unknown): Record<string, number> {
  if (typeof saved !== 'object' || saved === null || Array.isArray(saved)) return {};
  return Object.fromEntries(
    Object.entries(saved).filter(([, v]) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100_000),
  ) as Record<string, number>;
}

/**
 * The last `count` days ending today, for the stepping stones (oldest first).
 * Days before the first brushing are water.
 */
export function recentTrail(summary: StreakSummary, now: Date, count = 7): TrailDay[] {
  const today = localDate(now);
  const byDate = new Map(summary.trail.map((d) => [d.date, d]));
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(today, i - count + 1);
    return byDate.get(date) ?? { date, kind: 'water', today: date === today, gift: false };
  });
}
