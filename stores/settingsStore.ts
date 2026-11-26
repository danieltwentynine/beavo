import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { introSeenFromSaved } from '@/src/data/launch';
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
  /** False until the saved settings have been read. */
  loaded: boolean;
  markIntroSeen: () => void;
  setBrushingDuration: (sec: BrushingDuration) => void;
  setParentPin: (pin: string) => void;
  /** Count a wrong PIN (true) or clear the count after the right one (false). */
  recordPinTry: (wrong: boolean) => void;
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
      loaded: false,
      setBrushingDuration: (brushingDurationSec) => set({ brushingDurationSec }),
      markIntroSeen: () => set({ introSeen: true }),
      setParentPin: (parentPin) => {
        SecureStore.setItem(PIN_KEY, parentPin, PIN_OPTIONS); // throws if it can't be saved: the gate stays closed
        set({ parentPin, hasPin: true, pinUnreadable: false, pinLock: NO_LOCK });
      },
      recordPinTry: (wrong) => set((s) => ({ pinLock: wrong ? afterWrongPin(s.pinLock, Date.now()) : NO_LOCK })),
    }),
    {
      name: 'beavo.settings.v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ brushingDurationSec, introSeen, hasPin, pinLock }) => ({ brushingDurationSec, introSeen, hasPin, pinLock }),
      // Storage is untrusted input: anything unexpected keeps the default.
      merge: (saved, current) => {
        settingsRead = saved && typeof saved === 'object' ? { kind: 'saved' } : { kind: 'empty' };
        const s = (saved ?? {}) as { brushingDurationSec?: unknown; introSeen?: unknown; hasPin?: unknown; pinLock?: unknown };
        return {
          ...current,
          introSeen: introSeenFromSaved(s),
          hasPin: s.hasPin === true,
          pinLock: isPinLock(s.pinLock) ? s.pinLock : NO_LOCK,
          brushingDurationSec: isDuration(s.brushingDurationSec) ? s.brushingDurationSec : current.brushingDurationSec,
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
