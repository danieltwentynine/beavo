import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Brushing length choices (seconds). 2 minutes is the default dentists recommend. */
export const BRUSHING_DURATIONS = [60, 90, 120, 150, 180] as const;
export type BrushingDuration = (typeof BRUSHING_DURATIONS)[number];
export const DEFAULT_BRUSHING_DURATION: BrushingDuration = 120;

interface SettingsState {
  brushingDurationSec: BrushingDuration;
  /** The first-launch intro has been shown on this device. */
  introSeen: boolean;
  /** False until the saved settings have been read. */
  loaded: boolean;
  markIntroSeen: () => void;
  setBrushingDuration: (sec: BrushingDuration) => void;
}

const isDuration = (v: unknown): v is BrushingDuration => BRUSHING_DURATIONS.some((d) => d === v);

/**
 * App settings for this device (not synced: they describe how this phone is
 * used, and hold no personal data). Read from storage on first use.
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      brushingDurationSec: DEFAULT_BRUSHING_DURATION,
      introSeen: false,
      loaded: false,
      setBrushingDuration: (brushingDurationSec) => set({ brushingDurationSec }),
      markIntroSeen: () => set({ introSeen: true }),
    }),
    {
      name: 'beavo.settings.v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ brushingDurationSec, introSeen }) => ({ brushingDurationSec, introSeen }),
      // Storage is untrusted input: anything unexpected keeps the default.
      merge: (saved, current) => {
        const s = (saved ?? {}) as { brushingDurationSec?: unknown; introSeen?: unknown };
        return {
          ...current,
          introSeen: s.introSeen === true,
          brushingDurationSec: isDuration(s.brushingDurationSec) ? s.brushingDurationSec : current.brushingDurationSec,
        };
      },
      // Runs after a read that failed too: the defaults stay.
      onRehydrateStorage: () => () => useSettingsStore.setState({ loaded: true }),
    },
  ),
);
