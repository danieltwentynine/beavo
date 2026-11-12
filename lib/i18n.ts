import { getLocales } from 'expo-localization';

import { pickLocale, translate, type TranslationKey } from '@/lib/translations';

/**
 * The app language, from the device's preferred languages. Read once at launch:
 * iOS restarts the app when the language changes, so there is nothing to
 * subscribe to, and `t` is safe to call at module scope.
 */
export const locale = pickLocale(getLocales().map((l) => l.languageTag));

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  return translate(locale, key, params);
}
