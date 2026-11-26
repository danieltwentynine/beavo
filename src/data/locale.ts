import type { Locale } from '@/types';

/**
 * The app language (pure, for node --test; lib/i18n.ts feeds it the device
 * language). `forced` wins when set: on the user-test-ptbr branch every device
 * runs in pt-BR (lib/i18n.ts FORCED_LOCALE). Otherwise English and Spanish
 * when the device uses them, pt-BR for everything else.
 */
export function pickLocale(deviceLanguage: string | null | undefined, forced: Locale | null): Locale {
  if (forced) return forced;
  return deviceLanguage === 'en' ? 'en' : deviceLanguage === 'es' ? 'es' : 'pt-BR';
}
