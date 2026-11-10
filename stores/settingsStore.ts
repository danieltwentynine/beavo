import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

/** Brushing length choices (seconds). 2 minutes is the default dentists recommend. */
export const BRUSHING_DURATIONS = [60, 90, 120, 150, 180] as const;
export type BrushingDuration = (typeof BRUSHING_DURATIONS)[number];
export const DEFAULT_BRUSHING_DURATION: BrushingDuration = 120;

const KEY = 'beavo.settings.v1';

interface SettingsState {
  brushingDurationSec: BrushingDuration;
  /** The first-launch intro has been shown on this device. */
  introSeen: boolean;
  /** False until the saved settings have been read. */
  loaded: boolean;
  markIntroSeen: () => void;
  setBrushingDuration: (sec: BrushingDuration) => void;
  load: () => Promise<void>;
}

const isDuration = (v: unknown): v is BrushingDuration => BRUSHING_DURATIONS.some((d) => d === v);

/**
 * App settings for this device (not synced: they describe how this phone is
 * used, and hold no personal data). Loaded once in app/_layout.tsx.
 */
export const useSettingsStore = create<SettingsState>((set, get) => {
  const save = () => {
    const { brushingDurationSec, introSeen } = get();
    void AsyncStorage.setItem(KEY, JSON.stringify({ brushingDurationSec, introSeen })).catch(() => undefined);
  };
  return {
    brushingDurationSec: DEFAULT_BRUSHING_DURATION,
    introSeen: false,
    loaded: false,
    setBrushingDuration: (brushingDurationSec) => {
      set({ brushingDurationSec });
      save();
    },
    markIntroSeen: () => {
      set({ introSeen: true });
      save();
    },
    load: async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        const saved = parsed && typeof parsed === 'object' ? (parsed as { brushingDurationSec?: unknown; introSeen?: unknown }) : {};
        if (isDuration(saved.brushingDurationSec)) set({ brushingDurationSec: saved.brushingDurationSec });
        if (saved.introSeen === true) set({ introSeen: true });
      } catch {
        // Defaults stay.
      }
      set({ loaded: true });
    },
  };
});
