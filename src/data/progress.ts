import type { BrushingSession, BrushingSlot } from '@/types';

import { addDays, localDate, parseDay, slotsActiveOn } from './schedule.ts';
import { summarizeStreak } from './streak.ts';

export { addDays };

/**
 * Progress for one child, from its slots (archived included) and sessions.
 * A day is COMPLETE when every slot active that day has a completed session
 * (owner decision, 2026-10-31): the week dots, completion rate and full-week
 * badge use it. The STREAK is daily instead (owner, 2026-11-27): see streak.ts.
 * Pure, so `node --test` runs it.
 */

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

/** Latest completed session in each slot on a given day. Early stops never replace it. */
export function latestCompletionsForDay(sessions: readonly BrushingSession[], date: string): Map<string, BrushingSession> {
  const bySlot = new Map<string, BrushingSession>();
  for (const session of sessions) {
    if (session.date !== date || !session.completed) continue;
    const previous = bySlot.get(session.slotId);
    if (!previous || session.startedAt > previous.startedAt) bySlot.set(session.slotId, session);
  }
  return bySlot;
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
 * Everything the Progress tab shows. The streak numbers come from streak.ts
 * (daily, with freezes and bridges); pass `childId` so the freeze gifts are
 * computed for this child — without it no freeze is ever granted. The weekly
 * badge still needs seven COMPLETE days Mon–Sun. For the rate, today's slots
 * count only when done or when their window has ended.
 */
export function summarizeProgress(
  slots: readonly BrushingSlot[],
  sessions: readonly BrushingSession[],
  now: Date,
  childId?: string,
): ProgressSummary {
  const today = localDate(now);
  const done = completedBySlotDay(sessions);
  const status = (day: string) => dayStatusWith(slots, done, day);
  const start = firstDay(slots);
  const { currentStreak, bestStreak } = summarizeStreak(sessions, now, childId ?? null);

  // Full Mon–Sun week of complete days: walk the child's history once.
  let run = 0;
  let fullWeek = false;
  if (start) {
    for (let day = start; day <= today; day = addDays(day, 1)) {
      if (status(day).complete) {
        run++;
        // A run that ends on a Sunday and covers Mon–Sun is a complete week.
        if (run >= 7 && parseDay(day).getDay() === 0) fullWeek = true;
      } else if (day !== today) {
        run = 0;
      }
    }
  }

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

/** "Wed, 18 Nov · 13:00" in the device's language. */
export const formatWhen = (d: Date): string =>
  `${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;

/** Seconds as m:ss ("0:51"). */
export const formatDuration = (sec: number): string => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
