import type { ToothZone } from '@/types';

/**
 * Builds a warm, kid-friendly coaching message (CLAUDE.md > Gemini Coach voice).
 * Phase 1 uses this local generator; Phase 2 will swap in the Gemini Flash call
 * with this as the offline/rate-limited fallback. Never clinical, never scolding.
 */
export function buildCoachMessage(childName: string, missedZones: ToothZone[], score: number): string {
  const name = childName.trim() || 'friend';
  if (missedZones.length === 0 || score >= 100) {
    return `You did it, ${name}! Keep brushing every day and your teeth will sparkle.`;
  }
  const missedBackTeeth = missedZones.some((z) => z.includes('back'));
  if (missedBackTeeth) {
    return `Awesome job, ${name}! Tomorrow, try to reach all the way to your back teeth.`;
  }
  return `Great brushing today, ${name}! Your smile is getting stronger every day.`;
}

/**
 * Little cheers shown while brushing — one per step of the guide, in order, so
 * "Halfway hero" lands at the halfway mark and the last one at the finish.
 * Pure encouragement on purpose: no technique tips, nothing clinical
 * (docs/CLINICAL.md). Short enough to fit a sticker on one line.
 */
export const BRUSHING_CHEERS = [
  'Bubble power, go!',
  'Look at you go',
  'Wiggle, wiggle, shine',
  'Sparkle mode: on',
  'Your smile is glowing',
  'Halfway hero!',
  'Foam party in here',
  'Super brusher at work',
  'So close, keep shining',
  'Big finish, superstar!',
] as const;
