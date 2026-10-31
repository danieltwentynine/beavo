import type { BrushingSlot, MealType } from '@/types';

/**
 * Pure brushing-schedule logic. No firebase or RN imports, so `node --test`
 * runs it directly (only type imports, which Node strips).
 */

/** Local calendar date as YYYY-MM-DD (the `date` field on sessions). */
export function localDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isValidTime = (s: string): boolean => TIME.test(s);

/** Windows stay inside one day: start must be before end (no overnight slots). */
export const isValidWindow = (start: string, end: string): boolean =>
  isValidTime(start) && isValidTime(end) && start < end;

export type NewSlot = Omit<BrushingSlot, 'id' | 'createdAt' | 'archivedAt'>;

export interface DefaultSlotLabels {
  breakfast: string;
  lunch: string;
  dinner: string;
}

/** The three meal-tied slots every new child starts with. */
export function defaultSlots(labels: DefaultSlotLabels): NewSlot[] {
  const slot = (mealType: Exclude<MealType, 'custom'>, icon: string, windowStart: string, windowEnd: string, sortOrder: number): NewSlot => ({
    label: labels[mealType],
    icon,
    mealType,
    windowStart,
    windowEnd,
    sortOrder,
  });
  return [
    slot('breakfast', 'sun', '06:00', '10:00', 0),
    slot('lunch', 'cloud-sun', '11:00', '15:00', 1),
    slot('dinner', 'moon', '18:00', '22:00', 2),
  ];
}

const bySortOrder = (a: BrushingSlot, b: BrushingSlot) => a.sortOrder - b.sortOrder;

/**
 * Slots that existed at any moment of local day `day` (YYYY-MM-DD): created on
 * or before it, and not archived before it started. A slot archived today
 * still counts today, so archiving never erases a session already brushed.
 * A slot created today counts today too.
 */
export function slotsActiveOn(slots: readonly BrushingSlot[], day: string): BrushingSlot[] {
  return slots
    .filter((s) => localDate(s.createdAt) <= day && (!s.archivedAt || localDate(s.archivedAt) >= day))
    .sort(bySortOrder);
}

/** Slots not archived — the ones the parent edits. */
export const currentSlots = (slots: readonly BrushingSlot[]): BrushingSlot[] =>
  slots.filter((s) => !s.archivedAt).sort(bySortOrder);

const minutes = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * The slot a session started at `at` belongs to: the one whose window contains
 * it, else the one with the nearest window edge. Null only with no slots.
 */
export function pickSlotForTime(slots: readonly BrushingSlot[], at: Date): BrushingSlot | null {
  const now = at.getHours() * 60 + at.getMinutes();
  let best: BrushingSlot | null = null;
  let bestDistance = Infinity;
  for (const s of [...slots].sort(bySortOrder)) {
    const start = minutes(s.windowStart);
    const end = minutes(s.windowEnd);
    const distance = now < start ? start - now : now > end ? now - end : 0;
    if (distance < bestDistance) {
      best = s;
      bestDistance = distance;
    }
  }
  return best;
}

/** The slot whose window contains `at` (windows are inclusive), or null. */
export function slotAt(slots: readonly BrushingSlot[], at: Date): BrushingSlot | null {
  const now = at.getHours() * 60 + at.getMinutes();
  return [...slots].sort(bySortOrder).find((s) => minutes(s.windowStart) <= now && now <= minutes(s.windowEnd)) ?? null;
}

/**
 * A slot with sessions is archived, never hard-deleted. `hasSessions` is null
 * when we couldn't ask the server (offline) — archive then too, since the
 * local cache may not hold every session.
 */
export const slotRemoval = (hasSessions: boolean | null): 'archive' | 'delete' =>
  hasSessions === false ? 'delete' : 'archive';

/** Every child keeps at least one slot. */
export const canRemoveSlot = (current: readonly BrushingSlot[]): boolean => current.length > 1;

/** New id order after moving `id` one step up (-1) or down (+1). Unchanged at the ends. */
export function moveSlot(current: readonly BrushingSlot[], id: string, step: -1 | 1): string[] {
  const ids = [...current].sort(bySortOrder).map((s) => s.id);
  const from = ids.indexOf(id);
  const to = from + step;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  [ids[from], ids[to]] = [ids[to], ids[from]];
  return ids;
}
