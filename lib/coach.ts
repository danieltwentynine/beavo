import type { ToothZone } from '@/types';
import { t, type StringKey } from '@/lib/i18n';

/**
 * The closing message after a session, in the app language. Local, reviewed
 * templates only — no AI tips (ADR 0003). Never clinical,
 * never scolding. The wording lives in lib/i18n.ts (`coach.*`).
 */
export function buildCoachMessage(childName: string, missedZones: ToothZone[], score: number): string {
  const name = childName.trim() || t('common.friend');
  if (missedZones.length === 0 || score >= 100) return t('coach.perfect', { name });
  if (missedZones.some((z) => z.includes('back'))) return t('coach.backTeeth', { name });
  return t('coach.default', { name });
}

/**
 * Little cheers shown while brushing: one per step of the guide, in order, so
 * the halfway one lands at the halfway mark and the last one at the finish.
 * Pure encouragement on purpose — no technique tips, nothing clinical
 * (docs/CLINICAL.md). Each must fit the sticker on one line.
 */
const CHEER_COUNT = 10;

export function brushingCheer(step: number): string {
  return t(`cheer.${Math.max(0, Math.min(step, CHEER_COUNT - 1))}` as StringKey);
}
