import { useEffect, useMemo } from 'react';

import { useSettingsStore } from '@/stores/settingsStore';
import { summarizeStreak, withBestFloor, type StreakSummary } from '@/src/data/streak';
import type { BrushingSession } from '@/types';

/**
 * The child's trail as the screens must show it: summarizeStreak with the
 * record floored by what this device already showed, so "Maior trilha" never
 * goes down when a back-dated brushing syncs late (streak.ts withBestFloor).
 * Null until the history has loaded (`sessions` null), so a half-loaded
 * history never raises or shows a record.
 */
export function useStreakSummary(childId: string | null, sessions: readonly BrushingSession[] | null, now: Date): StreakSummary | null {
  const floor = useSettingsStore((s) => (childId ? s.bestTrail[childId] : undefined));
  const day = now.toDateString();
  const summary = useMemo(
    () => (childId && sessions ? withBestFloor(summarizeStreak(sessions, now, childId), floor) : null),
    // `day` stands for `now`: the trail changes by day, not by render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [childId, sessions, floor, day],
  );
  const best = summary?.bestStreak ?? 0;
  useEffect(() => {
    if (childId && best > 0) useSettingsStore.getState().raiseBestTrail(childId, best);
  }, [childId, best]);
  return summary;
}
