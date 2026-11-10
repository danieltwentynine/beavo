import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

/** Brushing length choices (seconds). 2 minutes is the default dentists recommend. */
export const BRUSHING_DURATIONS = [60, 90, 120, 150, 180] as const;
export type BrushingDuration = (typeof BRUSHING_DURATIONS)[number];
export const DEFAULT_BRUSHING_DURATION: BrushingDuration = 120;

const KEY = 'beavo.settings.v1';

interface SettingsState {
  brushingDurationSec: BrushingDuration;
  setBrushingDuration: (sec: BrushingDuration) => void;
  load: () => Promise<void>;
}

const isDuration = (v: unknown): v is BrushingDuration => BRUSHING_DURATIONS.some((d) => d === v);

/**
 * App settings for this device (not synced: they describe how this phone is
 * used, and hold no personal data). Loaded once in app/_layout.tsx.
 */
export const useSettingsStore = create<SettingsState>((set) => ({
  brushingDurationSec: DEFAULT_BRUSHING_DURATION,
  setBrushingDuration: (brushingDurationSec) => {
    set({ brushingDurationSec });
    void AsyncStorage.setItem(KEY, JSON.stringify({ brushingDurationSec })).catch(() => undefined);
  },
  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      const sec = parsed && typeof parsed === 'object' ? (parsed as { brushingDurationSec?: unknown }).brushingDurationSec : undefined;
      if (isDuration(sec)) set({ brushingDurationSec: sec });
    } catch {
      // Defaults stay.
    }
  },
}));
