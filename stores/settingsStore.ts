import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { NO_LOCK, afterWrongPin, isPinLock, type PinLock } from '@/src/data/pinLock';

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
// never in a backup. The Keychain outlives the app, so a fresh install clears it.
const PIN_KEY = 'beavo.parentPin';
const PIN_OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
function readPin(): string | null {
  try {
    const pin = SecureStore.getItem(PIN_KEY, PIN_OPTIONS);
    return isPin(pin) ? pin : null;
  } catch {
    return null; // unreadable: the parent confirms with the phone and chooses a new one
  }
}

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
      parentPin: readPin(),
      pinLock: NO_LOCK,
      loaded: false,
      setBrushingDuration: (brushingDurationSec) => set({ brushingDurationSec }),
      markIntroSeen: () => set({ introSeen: true }),
      setParentPin: (parentPin) => {
        SecureStore.setItem(PIN_KEY, parentPin, PIN_OPTIONS); // throws if it can't be saved: the gate stays closed
        set({ parentPin, pinLock: NO_LOCK });
      },
      recordPinTry: (wrong) => set((s) => ({ pinLock: wrong ? afterWrongPin(s.pinLock, Date.now()) : NO_LOCK })),
    }),
    {
      name: 'beavo.settings.v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ brushingDurationSec, introSeen, pinLock }) => ({ brushingDurationSec, introSeen, pinLock }),
      // Storage is untrusted input: anything unexpected keeps the default.
      merge: (saved, current) => {
        const s = (saved ?? {}) as { brushingDurationSec?: unknown; introSeen?: unknown; pinLock?: unknown };
        const firstLaunch = s.introSeen !== true;
        if (firstLaunch) void SecureStore.deleteItemAsync(PIN_KEY, PIN_OPTIONS).catch(() => undefined);
        return {
          ...current,
          introSeen: s.introSeen === true,
          parentPin: firstLaunch ? null : current.parentPin,
          pinLock: isPinLock(s.pinLock) ? s.pinLock : NO_LOCK,
          brushingDurationSec: isDuration(s.brushingDurationSec) ? s.brushingDurationSec : current.brushingDurationSec,
        };
      },
      // Runs after a read that failed too: the defaults stay.
      onRehydrateStorage: () => () => useSettingsStore.setState({ loaded: true }),
    },
  ),
);
