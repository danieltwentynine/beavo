import type { BrushingSession, BrushingSlot } from '@/types';

import { localDate, slotsActiveOn } from './schedule.ts';

/**
 * Progress for one child, from its slots (archived included) and sessions.
 * A day is COMPLETE when every slot active that day has a completed session
 * (owner decision, 2026-10-31). Pure, so `node --test` runs it.
 */

const parseDay = (day: string): Date => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** `day` shifted by `n` calendar days (DST-safe: works on Y/M/D, not milliseconds). */
export function addDays(day: string, n: number): string {
  const d = parseDay(day);
  return localDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

/** Monday → Sunday of the week containing `day`. */
export function weekOf(day: string): string[] {
  const mondayOffset = (parseDay(day).getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => addDays(day, i - mondayOffset));
}

export interface DayStatus {
  date: string;
  /** One entry per slot active that day, in slot order. */
  slots: { slotId: string; done: boolean }[];
  complete: boolean;
}

/** Slot ids with a completed session, per day. */
function completedBySlotDay(sessions: readonly BrushingSession[]): Set<string> {
  return new Set(sessions.filter((s) => s.completed).map((s) => `${s.date}|${s.slotId}`));
}

export function dayStatus(slots: readonly BrushingSlot[], sessions: readonly BrushingSession[], day: string): DayStatus {
  return dayStatusWith(slots, completedBySlotDay(sessions), day);
}

function dayStatusWith(slots: readonly BrushingSlot[], done: Set<string>, day: string): DayStatus {
  const active = slotsActiveOn(slots, day).map((s) => ({ slotId: s.id, done: done.has(`${day}|${s.id}`) }));
  return { date: day, slots: active, complete: active.length > 0 && active.every((s) => s.done) };
}

/** The first day the child had any slot (the start of their history). */
function firstDay(slots: readonly BrushingSlot[]): string | null {
  return slots.reduce<string | null>((min, s) => {
    const d = localDate(s.createdAt);
    return min === null || d < min ? d : min;
  }, null);
}

export interface ProgressSummary {
  week: DayStatus[];
  currentStreak: number;
  bestStreak: number;
  /** Completed / due slot-sessions over the last 30 days, 0–1; null with nothing due yet. */
  completionRate: number | null;
  badges: { firstSession: boolean; streak: boolean; weeklyGoal: boolean };
}

export const STREAK_BADGE_DAYS = 3;
const RATE_DAYS = 30;

/**
 * Everything the Progress tab shows. Today counts toward the streak only once
 * it is complete — an unfinished today never breaks it. For the rate, today's
 * slots count only when done or when their window has ended.
 */
export function summarizeProgress(
  slots: readonly BrushingSlot[],
  sessions: readonly BrushingSession[],
  now: Date,
): ProgressSummary {
  const today = localDate(now);
  const done = completedBySlotDay(sessions);
  const status = (day: string) => dayStatusWith(slots, done, day);
  const start = firstDay(slots);

  // Streaks: walk every day of the child's history once.
  let bestStreak = 0;
  let run = 0;
  let fullWeek = false;
  if (start) {
    for (let day = start; day <= today; day = addDays(day, 1)) {
      const complete = status(day).complete;
      if (complete) {
        run++;
        bestStreak = Math.max(bestStreak, run);
        // A run that ends on a Sunday and covers Mon–Sun is a complete week.
        if (run >= 7 && parseDay(day).getDay() === 0) fullWeek = true;
      } else if (day !== today) {
        run = 0;
      }
    }
  }
  const todayComplete = status(today).complete;
  let currentStreak = todayComplete ? 1 : 0;
  for (let day = addDays(today, -1); start && day >= start && status(day).complete; day = addDays(day, -1)) currentStreak++;

  // Completion rate over the last 30 days.
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let due = 0;
  let completed = 0;
  for (let i = RATE_DAYS - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    const active = slotsActiveOn(slots, day);
    for (const slot of active) {
      const isDone = done.has(`${day}|${slot.id}`);
      const windowOver = day < today || Number(slot.windowEnd.slice(0, 2)) * 60 + Number(slot.windowEnd.slice(3)) <= nowMinutes;
      if (isDone || windowOver) {
        due++;
        if (isDone) completed++;
      }
    }
  }

  return {
    week: weekOf(today).map(status),
    currentStreak,
    bestStreak,
    completionRate: due === 0 ? null : completed / due,
    badges: {
      firstSession: sessions.some((s) => s.completed),
      streak: bestStreak >= STREAK_BADGE_DAYS,
      weeklyGoal: fullWeek,
    },
  };
}

/** Newest first, by start time. */
export const sessionsNewestFirst = (sessions: readonly BrushingSession[]): BrushingSession[] =>
  [...sessions].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
