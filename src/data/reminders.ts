import type { BrushingSlot } from '@/types';

import { addDays, currentSlots, isValidTime, localDate, parseDay } from './schedule.ts';

/**
 * Brushing reminders: pure planning, no expo or firebase imports, so
 * `node --test` runs it. The native side (lib/reminders.ts) only applies the
 * plan.
 *
 * Owner decisions (PLANO v3 + Vex v3, 2026-11-27):
 * - Local notifications on THIS phone only: no push server, no token, nothing
 *   leaves the device. Off until an adult accepts (opt-in passes the gate).
 * - One reminder per slot at the chosen time, inside the slot window, outside
 *   quiet hours; skipped when that slot is already brushed and the device
 *   knows it. At most 3 a day for the whole device, siblings merged.
 * - Planned 7 days ahead as one-shot reminders, re-planned whenever the app
 *   opens or data changes. A family that stops opening the app simply stops
 *   getting them after a week: nothing asks them to come back.
 * - The content is fixed and neutral (no name, no count, no health, no
 *   streak); the payload only says it is a reminder.
 */

export const REMINDER_RULES = {
  horizonDays: 7,
  maxPerDay: 3,
} as const;

export interface QuietHours {
  /** HH:MM, inclusive. */
  start: string;
  /** HH:MM, exclusive. start > end wraps midnight; start == end means none. */
  end: string;
}

/** Forge's proposal, adopted in PLANO v3 §5. */
export const DEFAULT_QUIET_HOURS: QuietHours = { start: '21:00', end: '07:00' };

/** A slot's reminder on this device. `time: null` = the default for that slot. */
export interface SlotReminderPref {
  on: boolean;
  time: string | null;
}

/** Keyed by `prefKey(childId, slotId)`. Missing = on, default time. */
export type ReminderPrefs = Record<string, SlotReminderPref>;

export const prefKey = (childId: string, slotId: string): string => `${childId}|${slotId}`;

/** Ids of every notification we schedule start with this, so we never touch anyone else's. */
export const REMINDER_ID_PREFIX = 'beavo-reminder:';

/** The only thing a reminder carries. */
export const REMINDER_PAYLOAD = { kind: 'reminder' } as const;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const minutes = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export function inQuietHours(time: string, quiet: QuietHours): boolean {
  const t = minutes(time);
  const s = minutes(quiet.start);
  const e = minutes(quiet.end);
  if (s === e) return false;
  return s < e ? t >= s && t < e : t >= s || t < e;
}

/**
 * The default reminder time for a slot: its window start, or the end of the
 * quiet hours when the start falls inside them (06:00 breakfast → 07:00).
 * Null when the whole window is quiet.
 */
export function defaultReminderTime(slot: Pick<BrushingSlot, 'windowStart' | 'windowEnd'>, quiet: QuietHours): string | null {
  if (!inQuietHours(slot.windowStart, quiet)) return slot.windowStart;
  const end = minutes(quiet.end);
  if (end > minutes(slot.windowStart) && end <= minutes(slot.windowEnd)) return quiet.end;
  return null;
}

/** A chosen time kept inside the slot window (an edited slot carries its reminder along). */
export function clampToWindow(time: string, slot: Pick<BrushingSlot, 'windowStart' | 'windowEnd'>): string {
  if (time < slot.windowStart) return slot.windowStart;
  if (time > slot.windowEnd) return slot.windowEnd;
  return time;
}

/** When this slot's reminder fires, or null when it is off, has no time, or the time is in quiet hours. */
export function reminderTimeFor(
  slot: Pick<BrushingSlot, 'windowStart' | 'windowEnd'>,
  pref: SlotReminderPref | undefined,
  quiet: QuietHours,
): string | null {
  if (pref && !pref.on) return null;
  const time = pref?.time && isValidTime(pref.time) ? clampToWindow(pref.time, slot) : defaultReminderTime(slot, quiet);
  return time && !inQuietHours(time, quiet) ? time : null;
}

/**
 * At most `max` times in a day: the two closest neighbours merge into the
 * earlier one until it fits, so siblings' nearby times share one reminder.
 */
export function capTimes(times: readonly string[], max: number = REMINDER_RULES.maxPerDay): string[] {
  const out = [...new Set(times)].sort();
  while (out.length > max) {
    let at = 1;
    for (let i = 2; i < out.length; i++) {
      if (minutes(out[i]) - minutes(out[i - 1]) < minutes(out[at]) - minutes(out[at - 1])) at = i;
    }
    out.splice(at, 1);
  }
  return out;
}

export interface ReminderChild {
  childId: string;
  /** All the child's slots (archived ones are ignored). */
  slots: readonly BrushingSlot[];
  /** `${date}|${slotId}` of brushings this device knows about (any saved session). */
  brushed: ReadonlySet<string>;
}

export interface PlannedReminder {
  /** Stable for the same zone, day and time, so re-planning is a no-op. */
  id: string;
  fireAt: Date;
  day: string;
  time: string;
}

/**
 * The fire instants (epoch ms) this device has scheduled, device-only and
 * temporary (the last 2 days and the plan ahead). Used so the daily cap holds
 * across re-plans: a reminder already past may have fired and still counts.
 * Instants, not wall-clock times, so a timezone change can't free budget
 * (Vex round 2): they are counted per local day of the zone the phone is in
 * when the plan is made.
 */
export type ReminderLog = number[];

const LOG_PAST_MS = 2 * 86_400_000;
const LOG_AHEAD_MS = (REMINDER_RULES.horizonDays + 1) * 86_400_000;

export interface PlanInput {
  enabled: boolean;
  children: readonly ReminderChild[];
  prefs: ReminderPrefs;
  quiet: QuietHours;
  now: Date;
  /** IANA zone the plan is made in; part of the id, so a zone change replaces every reminder. */
  zone: string;
  /** What earlier plans scheduled (see ReminderLog). Omit for a preview of a fresh day. */
  log?: ReminderLog;
  horizonDays?: number;
}

export const reminderId = (zone: string, day: string, time: string): string => `${REMINDER_ID_PREFIX}${zone}:${day}T${time}`;

const atTime = (day: string, time: string): Date => {
  const base = parseDay(day);
  const [h, m] = time.split(':').map(Number);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m);
};
const wallClock = (d: Date): string => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Earlier reminders already past whose instant falls on local `day` now: they may have fired, so they use up the day's budget. */
export function firedOn(log: ReminderLog | undefined, day: string, now: Date): number[] {
  return (log ?? []).filter((ms) => ms <= now.getTime() && localDate(new Date(ms)) === day);
}

/**
 * Every reminder this device should have pending, soonest first.
 * - At most `maxPerDay` a day INCLUDING ones already past today (`log`).
 * - Each reminder must fire at its own wall-clock time: a time that doesn't
 *   exist that day (DST spring-forward) is moved by the clock, so it is
 *   re-checked in the real local time and dropped if that falls in quiet hours
 *   or outside every slot window it came from.
 */
export function planReminders({ enabled, children, prefs, quiet, now, zone, log, horizonDays = REMINDER_RULES.horizonDays }: PlanInput): PlannedReminder[] {
  if (!enabled) return [];
  const today = localDate(now);
  const plan: PlannedReminder[] = [];
  for (let i = 0; i < horizonDays; i++) {
    const day = addDays(today, i);
    const windows = new Map<string, { start: string; end: string }[]>();
    for (const child of children) {
      for (const slot of currentSlots(child.slots)) {
        if (child.brushed.has(`${day}|${slot.id}`)) continue;
        const time = reminderTimeFor(slot, prefs[prefKey(child.childId, slot.id)], quiet);
        if (!time || atTime(day, time).getTime() <= now.getTime()) continue;
        windows.set(time, [...(windows.get(time) ?? []), { start: slot.windowStart, end: slot.windowEnd }]);
      }
    }
    const budget = REMINDER_RULES.maxPerDay - firedOn(log, day, now).length;
    if (budget <= 0) continue;
    for (const time of capTimes([...windows.keys()], budget)) {
      const fireAt = atTime(day, time);
      const actual = wallClock(fireAt);
      if (actual !== time) {
        const inWindow = (windows.get(time) ?? []).some((w) => actual >= w.start && actual <= w.end);
        if (inQuietHours(actual, quiet) || !inWindow || localDate(fireAt) !== day) continue;
      }
      plan.push({ id: reminderId(zone, day, time), fireAt, day, time });
    }
  }
  return plan;
}

/**
 * The log after applying `plan`: past instants of the last 2 days are kept
 * (they may have fired), future ones are exactly what the plan scheduled.
 */
export function nextReminderLog(log: ReminderLog | undefined, plan: readonly PlannedReminder[], now: Date): ReminderLog {
  const t = now.getTime();
  const past = (log ?? []).filter((ms) => ms <= t && ms >= t - LOG_PAST_MS);
  return [...new Set([...past, ...plan.map((p) => p.fireAt.getTime())])].sort((a, b) => a - b);
}

/** Saved log (untrusted storage): integer instants in the window around now only. An older format reads as empty. */
export function reminderLogFromSaved(saved: unknown, now: Date): ReminderLog {
  if (!Array.isArray(saved)) return [];
  const t = now.getTime();
  return saved
    .filter((ms): ms is number => Number.isInteger(ms) && ms >= t - LOG_PAST_MS && ms <= t + LOG_AHEAD_MS)
    .sort((a, b) => a - b)
    .slice(-200);
}

/** What to cancel and what to add so the pending reminders match `plan`. Ignores ids that aren't ours. */
export function diffReminders(scheduledIds: readonly string[], plan: readonly PlannedReminder[]): { cancel: string[]; add: PlannedReminder[] } {
  const ours = new Set(scheduledIds.filter((id) => id.startsWith(REMINDER_ID_PREFIX)));
  const wanted = new Set(plan.map((p) => p.id));
  return {
    cancel: [...ours].filter((id) => !wanted.has(id)),
    add: plan.filter((p) => !ours.has(p.id)),
  };
}

/** The notification system, as the planner needs it (lib/reminders.ts wraps expo-notifications). */
export interface NotificationPort {
  scheduledIds(): Promise<string[]>;
  schedule(reminder: PlannedReminder): Promise<void>;
  cancel(id: string): Promise<void>;
  /** Last resort when single cancellations fail: every pending notification of this app (Beavo schedules only reminders). */
  cancelAll(): Promise<void>;
  /** Remove our delivered reminders from Notification Center. */
  dismissDelivered(): Promise<void>;
}

/**
 * Make the pending reminders match the plan. Cancels first, then schedules, so
 * the device never holds old and new together; one failure doesn't stop the
 * rest. `ok` is false when anything failed (the next re-plan tries again).
 */
export async function applyReminderPlan(port: NotificationPort, plan: readonly PlannedReminder[]): Promise<{ added: number; cancelled: number; ok: boolean }> {
  const { cancel, add } = diffReminders(await port.scheduledIds(), plan);
  let ok = true;
  let cancelled = 0;
  let added = 0;
  for (const id of cancel) {
    try {
      await port.cancel(id);
      cancelled++;
    } catch {
      ok = false;
    }
  }
  if (!ok) return { added, cancelled, ok }; // never schedule on top of reminders that failed to go
  for (const reminder of add) {
    try {
      await port.schedule(reminder);
      added++;
    } catch {
      ok = false;
    }
  }
  return { added, cancelled, ok };
}

/** Clear our delivered reminders (a child profile was deleted). True when it worked; never throws. */
export async function dismissDelivered(port: NotificationPort): Promise<boolean> {
  try {
    await port.dismissDelivered();
    return true;
  } catch {
    return false;
  }
}

/**
 * Run a clean-up with a persisted "pending" flag: set before, cleared only on
 * success, so a failure (or a killed app) is retried at the next launch or
 * foreground (useReminderSync).
 */
export async function withPendingFlag(work: () => Promise<boolean>, setPending: (pending: boolean) => void): Promise<boolean> {
  setPending(true);
  const ok = await work().catch(() => false);
  if (ok) setPending(false);
  return ok;
}

/**
 * Cancel every pending reminder and clear delivered ones (sign-out, erase,
 * account or child deletion). Tries each one; then checks what is left and
 * falls back to cancelling everything. Resolves true only when none of ours
 * is pending any more; false = the caller keeps it pending and retries.
 */
export async function clearReminders(port: NotificationPort): Promise<boolean> {
  const ours = async () => (await port.scheduledIds()).filter((id) => id.startsWith(REMINDER_ID_PREFIX));
  let left: string[] = [];
  try {
    for (const id of await ours()) {
      try {
        await port.cancel(id);
      } catch {
        // tried again below
      }
    }
    left = await ours();
    if (left.length > 0) {
      await port.cancelAll();
      left = await ours();
    }
  } catch {
    left = ['unknown'];
  }
  try {
    await port.dismissDelivered();
  } catch {
    return false;
  }
  return left.length === 0;
}

// ---- Device settings (kept in stores/settingsStore.ts, never synced) ----

export type ReminderOffer = 'unseen' | 'done';

export interface ReminderSettings {
  /** The owner (account uid or the device-only id) these settings belong to; another owner starts over. */
  ownerId: string | null;
  /** Only an adult turns this on (opt-in offer or Adultos → Lembretes, both behind the gate). */
  enabled: boolean;
  quiet: QuietHours;
  prefs: ReminderPrefs;
  /** 'done' once an adult answered the automatic offer, either way. Kept per device across owners; it never comes back by itself. */
  offer: ReminderOffer;
}

/**
 * Settings for a new owner on this device (sign-out → null, another account,
 * erased data): everything about reminders starts over and stays OFF, except
 * the answer to the automatic offer. That answer is kept for the DEVICE (not
 * the account, and without keeping any account id): once an adult said "Agora
 * não" (or accepted) on this phone, the offer never comes back by itself, after
 * sign-out, a restart or another sign-in. Adultos → Lembretes stays available.
 */
export const reminderSettingsForOwner = (previous: ReminderSettings, ownerId: string | null): ReminderSettings => ({
  ...defaultReminderSettings(ownerId),
  offer: previous.offer,
});

export const defaultReminderSettings = (ownerId: string | null = null): ReminderSettings => ({
  ownerId,
  enabled: false,
  quiet: DEFAULT_QUIET_HOURS,
  prefs: {},
  offer: 'unseen',
});


/** Read saved settings (untrusted local storage): anything malformed falls back to the defaults, off. */
export function reminderSettingsFromSaved(saved: unknown): ReminderSettings {
  if (!isRecord(saved)) return defaultReminderSettings();
  const quiet = isRecord(saved.quiet) && isValidTime(String(saved.quiet.start)) && isValidTime(String(saved.quiet.end))
    ? { start: String(saved.quiet.start), end: String(saved.quiet.end) }
    : DEFAULT_QUIET_HOURS;
  const prefs: ReminderPrefs = {};
  if (isRecord(saved.prefs)) {
    for (const [key, value] of Object.entries(saved.prefs)) {
      if (!isRecord(value) || typeof value.on !== 'boolean' || !key.includes('|')) continue;
      prefs[key] = { on: value.on, time: typeof value.time === 'string' && isValidTime(value.time) ? value.time : null };
    }
  }
  return {
    ownerId: typeof saved.ownerId === 'string' ? saved.ownerId : null,
    enabled: saved.enabled === true,
    quiet,
    prefs,
    offer: saved.offer === 'done' ? 'done' : 'unseen',
  };
}

/** Drop preferences of children no longer on this account (deleted profiles). */
export function prunePrefs(prefs: ReminderPrefs, childIds: readonly string[]): ReminderPrefs {
  const live = new Set(childIds);
  return Object.fromEntries(Object.entries(prefs).filter(([key]) => live.has(key.split('|')[0])));
}

// ---- The automatic offer (PLANO v3 §7 + Vex v3) ----

export interface OfferState {
  offer: ReminderOffer;
  enabled: boolean;
  ownerId: string | null;
  /** Children loaded and at least one exists (reminders need a routine). */
  hasChild: boolean;
  /** The active child is in kid mode (or still loading: fails closed). */
  kidMode: boolean;
}

/**
 * Show the offer once, to an adult: an owner with a child, outside kid mode,
 * never answered, not already on. In kid mode it waits for the next time an
 * adult is in the app.
 */
export const shouldOfferReminders = ({ offer, enabled, ownerId, hasChild, kidMode }: OfferState): boolean =>
  offer === 'unseen' && !enabled && ownerId !== null && hasChild && !kidMode;

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export type EnableResult = 'on' | 'denied' | 'cancelled';

/**
 * Turning reminders on, AFTER the parental gate passed (the caller runs it
 * through requireParent, even when the permission already exists). Asks the
 * system only if it hasn't been answered; a refusal keeps everything off.
 * `stillAllowed` is checked before the prompt and again after every await,
 * before anything is written: if the owner, consent, active child or kid mode
 * changed meanwhile (e.g. while the system prompt was open), nothing is saved
 * and the result is 'cancelled'.
 */
export async function enableAfterGate(deps: {
  permission: () => Promise<PermissionState>;
  request: () => Promise<PermissionState>;
  setEnabled: (on: boolean) => void;
  markOfferDone: () => void;
  stillAllowed?: () => boolean;
}): Promise<EnableResult> {
  const allowed = deps.stillAllowed ?? (() => true);
  if (!allowed()) return 'cancelled';
  let state = await deps.permission();
  if (!allowed()) return 'cancelled';
  if (state === 'undetermined') {
    state = await deps.request();
    if (!allowed()) return 'cancelled';
  }
  deps.markOfferDone();
  deps.setEnabled(state === 'granted');
  return state === 'granted' ? 'on' : 'denied';
}

/** One slot's row on Adultos → Lembretes: what fires and why not. */
export interface SlotReminderRow {
  slotId: string;
  on: boolean;
  /** The time it fires, or null. */
  time: string | null;
  /** The time the parent would pick by default. */
  defaultTime: string | null;
  /** On, but its time is in quiet hours (or the window is all quiet): it won't fire. */
  quietBlocked: boolean;
}

export function slotReminderRows(childId: string, slots: readonly BrushingSlot[], settings: Pick<ReminderSettings, 'prefs' | 'quiet'>): SlotReminderRow[] {
  return currentSlots(slots).map((slot) => {
    const pref = settings.prefs[prefKey(childId, slot.id)];
    const on = pref?.on ?? true;
    const chosen = pref?.time && isValidTime(pref.time) ? clampToWindow(pref.time, slot) : defaultReminderTime(slot, settings.quiet);
    const time = reminderTimeFor(slot, pref, settings.quiet);
    return { slotId: slot.id, on, time, defaultTime: defaultReminderTime(slot, settings.quiet), quietBlocked: on && (chosen === null || time === null) };
  });
}
