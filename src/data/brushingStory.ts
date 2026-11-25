const STORY_IDS = [0, 1, 2, 3] as const;

/** The next story cycles through the bundled catalogue using saved-session count. */
export function selectBrushingStory(sessionCount: number) {
  return STORY_IDS[sessionCount % STORY_IDS.length]!;
}

export type BrushingStory = (typeof STORY_IDS)[number];

/** Keep a story once chosen. An unknown count is distinct from a confirmed zero. */
export function resolveBrushingStory(current: BrushingStory | null, count: number | null): BrushingStory | null {
  if (current !== null || count === null) return current;
  return selectBrushingStory(count);
}

export function carriedSessionCount(activeChildId: string | undefined, historyChildId: string | undefined, historyCount: string | undefined) {
  if (!activeChildId || activeChildId !== historyChildId || !historyCount || !/^\d+$/.test(historyCount)) return null;
  const count = Number(historyCount);
  return Number.isSafeInteger(count) ? count : null;
}

const STORY_STEPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** At the end of the timer, hold the closing line through the results transition. */
export function brushingStoryStep(zonesReached: number) {
  return STORY_STEPS[Math.min(zonesReached, STORY_STEPS.length - 1)]!;
}
