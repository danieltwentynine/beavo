import { locale } from '@/lib/i18n';

/**
 * Accepted versions are stored on users/{uid}.consent (on the device only when Beavo is used without an account). Bump a version when its
 * document changes in substance: every parent is asked to accept again.
 * Must match the version line at the top of the matching files in /legal.
 */
export const LEGAL_VERSIONS = { terms: '2026-11-11', privacy: '2026-11-11' } as const;

/** Firebase Hosting default domain for project `zing-dental-app` (see firebase.json > hosting). */
const LEGAL_BASE_URL = 'https://zing-dental-app.web.app/legal';

// The documents exist in Portuguese and English only; Spanish devices get the English ones.
const legalLocale = locale === 'pt-BR' ? 'pt-BR' : 'en';

export const LEGAL_URLS = {
  terms: `${LEGAL_BASE_URL}/terms.${legalLocale}.html`,
  privacy: `${LEGAL_BASE_URL}/privacy-policy.${legalLocale}.html`,
} as const;

/** App Store id — fill in once the app exists in App Store Connect (until then the review link fails gracefully). */
const APP_STORE_ID = '[APP_STORE_ID]';
export const REVIEW_URL = `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`;
