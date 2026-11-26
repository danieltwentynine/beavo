/**
 * The /100 score shown after a session (pure, for node --test). Decision in
 * docs/decisions/0006-fix-sprint-v1-decisions.md:
 * - the score is the share of guide zones reached in the chosen length;
 * - a run set shorter than the recommended 2 minutes still counts as completed
 *   when the full chosen length ran, but its score is capped at
 *   SHORT_RUN_SCORE_CAP, so it never reaches 100 or the perfect message.
 */
export const RECOMMENDED_BRUSHING_SEC = 120;
export const SHORT_RUN_SCORE_CAP = 90;

export interface ScoreInput {
  /** Guide zones reached when the session ended (0…zoneCount). */
  reachedZones: number;
  zoneCount: number;
  /** The brushing length chosen for this session, in seconds. */
  totalSec: number;
}

export function scoreSession({ reachedZones, zoneCount, totalSec }: ScoreInput): number {
  if (zoneCount <= 0) return 0;
  const reached = Math.min(Math.max(reachedZones, 0), zoneCount);
  const score = Math.round((reached / zoneCount) * 100);
  return totalSec < RECOMMENDED_BRUSHING_SEC ? Math.min(score, SHORT_RUN_SCORE_CAP) : score;
}

/** The perfect closing message is earned only by a full score. */
export const isPerfectScore = (score: number): boolean => score >= 100;
