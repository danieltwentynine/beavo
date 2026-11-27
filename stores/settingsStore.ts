import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { introSeenFromSaved } from '@/src/data/launch';
import {
  defaultReminderSettings,
  prefKey,
  prunePrefs,
  reminderLogFromSaved,
  reminderSettingsForOwner,
  reminderSettingsFromSaved,
  type QuietHours,
  type ReminderLog,
  type ReminderSettings,
  type SlotReminderPref,
} from '@/src/data/reminders';
import { bestFloorsFromSaved } from '@/src/data/streak';
import { NO_LOCK, afterWrongPin, isPinLock, resolveStoredPin, type KeychainRead, type PinLock, type SettingsRead } from '@/src/data/pinLock';

/** Brushing length choices (seconds). 2 minutes is the default dentists recommend. */
export const BRUSHING_DURATIONS = [60, 90, 120, 150, 180] as const;
export type BrushingDuration = (typeof BRUSHING_DURATIONS)[number];
export const DEFAULT_BRUSHING_DURATION: BrushingDuration = 120;

interface SettingsState {
  brushingDurationSec: BrushingDuration;
  /** The first-launch intro has been shown on this device. */
  introSeen: boolean;
  /** The 4-digit PIN for the grown-ups check (kept in the Keychain); null until a parent has chosen one. */
  parentPin: string | null;
  /** A PIN was chosen on this install. The Keychain outlives the app, so a PIN found on an install's first launch is from an earlier install and is dropped. */
  hasPin: boolean;
  /** A PIN was chosen but the Keychain can't be read right now: the gate treats it as existing (no first-time setup). */
  pinUnreadable: boolean;
  /** Wrong PINs in a row and the wait they caused. */
  pinLock: PinLock;
  /** Brushing reminders on this phone (src/data/reminders.ts). Off until an adult turns them on. */
  reminders: ReminderSettings;
  /** Fire instants this device scheduled (last 2 days and ahead): the daily cap holds across re-plans and zone changes. No child data. */
  reminderLog: ReminderLog;
  /** A clearing (sign-out, erase, deletion) didn't finish: retried at the next launch or foreground. */
  reminderCleanupPending: boolean;
  /** Clearing delivered reminders (a child profile was deleted) didn't finish: retried at the next launch or foreground. */
  reminderDismissPending: boolean;
  /** Highest "Maior trilha" this device has shown, per child id: the record never goes down (streak.ts withBestFloor). */
  bestTrail: Record<string, number>;
  /** False until the saved settings have been read. */
  loaded: boolean;
  markIntroSeen: () => void;
  setBrushingDuration: (sec: BrushingDuration) => void;
  setParentPin: (pin: string) => void;
  /** Count a wrong PIN (true) or clear the count after the right one (false). */
  recordPinTry: (wrong: boolean) => void;
  /** Call only after the parental gate (see lib/reminders.ts enableReminders). */
  setRemindersEnabled: (on: boolean) => void;
  /** The adult answered the automatic offer (either way); it never comes back by itself. */
  markReminderOfferDone: () => void;
  setSlotReminder: (childId: string, slotId: string, pref: SlotReminderPref) => void;
  setQuietHours: (quiet: QuietHours) => void;
  /** Forget reminder settings of deleted children. */
  pruneReminderChildren: (childIds: readonly string[]) => void;
  /** Start over for `ownerId` (sign-out → null, another account, erased data). Keeps only the offer answer (device-wide). */
  resetReminders: (ownerId: string | null) => void;
  setReminderLog: (log: ReminderLog) => void;
  setReminderCleanupPending: (pending: boolean) => void;
  setReminderDismissPending: (pending: boolean) => void;
  /** Raise (never lower) the record floor shown for a child. */
  raiseBestTrail: (childId: string, best: number) => void;
}

export const isPin = (v: unknown): v is string => typeof v === 'string' && /^\d{4}$/.test(v);

// The PIN lives in the Keychain, not with the other settings: this device only,
// never in a backup.
const PIN_KEY = 'beavo.parentPin';
const PIN_OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
function readKeychain(): KeychainRead {
  try {
    const pin = SecureStore.getItem(PIN_KEY, PIN_OPTIONS);
    return isPin(pin) ? { kind: 'pin', pin } : { kind: 'none' };
  } catch {
    return { kind: 'error' }; // unreadable now: never treated as "no PIN" (src/data/pinLock.ts resolveStoredPin)
  }
}
const keychainAtLaunch = readKeychain();
// What the settings read found; set by `merge` (called only after a successful read).
let settingsRead: SettingsRead = { kind: 'error' };

const isDuration = (v: unknown): v is BrushingDuration => BRUSHING_DURATIONS.some((d) => d === v);

/**
 * App settings for this device (not synced: they describe how this phone is
 * used, and hold no personal data; the grown-ups PIN stays on this phone). Read from storage on first use.
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      brushingDurationSec: DEFAULT_BRUSHING_DURATION,
      introSeen: false,
      parentPin: keychainAtLaunch.kind === 'pin' ? keychainAtLaunch.pin : null,
      hasPin: false,
      pinUnreadable: false,
      pinLock: NO_LOCK,
      reminders: defaultReminderSettings(),
      reminderLog: [],
      reminderCleanupPending: false,
      reminderDismissPending: false,
      bestTrail: {},
      loaded: false,
      setBrushingDuration: (brushingDurationSec) => set({ brushingDurationSec }),
      markIntroSeen: () => set({ introSeen: true }),
      setParentPin: (parentPin) => {
        SecureStore.setItem(PIN_KEY, parentPin, PIN_OPTIONS); // throws if it can't be saved: the gate stays closed
        set({ parentPin, hasPin: true, pinUnreadable: false, pinLock: NO_LOCK });
      },
      recordPinTry: (wrong) => set((s) => ({ pinLock: wrong ? afterWrongPin(s.pinLock, Date.now()) : NO_LOCK })),
      setRemindersEnabled: (enabled) => set((s) => ({ reminders: { ...s.reminders, enabled } })),
      markReminderOfferDone: () => set((s) => ({ reminders: { ...s.reminders, offer: 'done' } })),
      setSlotReminder: (childId, slotId, pref) =>
        set((s) => ({ reminders: { ...s.reminders, prefs: { ...s.reminders.prefs, [prefKey(childId, slotId)]: pref } } })),
      setQuietHours: (quiet) => set((s) => ({ reminders: { ...s.reminders, quiet } })),
      pruneReminderChildren: (childIds) =>
        set((s) => {
          const prefs = prunePrefs(s.reminders.prefs, childIds);
          const live = new Set(childIds);
          const bestTrail = Object.fromEntries(Object.entries(s.bestTrail).filter(([id]) => live.has(id)));
          const samePrefs = Object.keys(prefs).length === Object.keys(s.reminders.prefs).length;
          const sameBest = Object.keys(bestTrail).length === Object.keys(s.bestTrail).length;
          return samePrefs && sameBest ? s : { reminders: { ...s.reminders, prefs }, bestTrail };
        }),
      // The record floors belong to the owner's children: they go with the owner.
      resetReminders: (ownerId) => set((s) => ({ reminders: reminderSettingsForOwner(s.reminders, ownerId), bestTrail: {} })),
      setReminderLog: (reminderLog) => set({ reminderLog }),
      setReminderCleanupPending: (reminderCleanupPending) => set({ reminderCleanupPending }),
      setReminderDismissPending: (reminderDismissPending) => set({ reminderDismissPending }),
      raiseBestTrail: (childId, best) =>
        set((s) => (Number.isInteger(best) && best > (s.bestTrail[childId] ?? 0) ? { bestTrail: { ...s.bestTrail, [childId]: best } } : s)),
    }),
    {
      name: 'beavo.settings.v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ brushingDurationSec, introSeen, hasPin, pinLock, reminders, reminderLog, reminderCleanupPending, reminderDismissPending, bestTrail }) =>
        ({ brushingDurationSec, introSeen, hasPin, pinLock, reminders, reminderLog, reminderCleanupPending, reminderDismissPending, bestTrail }),
      // Storage is untrusted input: anything unexpected keeps the default.
      merge: (saved, current) => {
        settingsRead = saved && typeof saved === 'object' ? { kind: 'saved' } : { kind: 'empty' };
        const s = (saved ?? {}) as {
          brushingDurationSec?: unknown; introSeen?: unknown; hasPin?: unknown; pinLock?: unknown;
          reminders?: unknown; reminderLog?: unknown; reminderCleanupPending?: unknown; reminderDismissPending?: unknown; bestTrail?: unknown;
        };
        return {
          ...current,
          introSeen: introSeenFromSaved(s),
          hasPin: s.hasPin === true,
          pinLock: isPinLock(s.pinLock) ? s.pinLock : NO_LOCK,
          brushingDurationSec: isDuration(s.brushingDurationSec) ? s.brushingDurationSec : current.brushingDurationSec,
          reminders: reminderSettingsFromSaved(s.reminders),
          reminderLog: reminderLogFromSaved(s.reminderLog, new Date()),
          reminderCleanupPending: s.reminderCleanupPending === true,
          reminderDismissPending: s.reminderDismissPending === true,
          bestTrail: bestFloorsFromSaved(s.bestTrail),
        };
      },
      // Runs after a read that failed too (then `merge` never ran and settingsRead
      // stays 'error'): the defaults stay, and a valid Keychain PIN is kept.
      onRehydrateStorage: () => () => {
        const stored = resolveStoredPin(keychainAtLaunch, settingsRead, useSettingsStore.getState().hasPin);
        if (stored.dropKeychain) void SecureStore.deleteItemAsync(PIN_KEY, PIN_OPTIONS).catch(() => undefined);
        useSettingsStore.setState({ loaded: true, parentPin: stored.pin, hasPin: stored.hasPin, pinUnreadable: stored.pinUnreadable });
      },
    },
  ),
);
