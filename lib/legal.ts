import { locale } from '@/lib/i18n';

/**
 * Accepted versions are stored on users/{uid}.consent (on the device only when Beavo is used without an account). Bump a version when its
 * document changes in substance: every parent is asked to accept again.
 * Must match the version line at the top of the matching files in /legal.
 */
export const LEGAL_VERSIONS = { terms: '2026-11-22', privacy: '2026-11-22' } as const;

/** Firebase Hosting default domain for project `beavo-dental` (see firebase.json > hosting). */
const LEGAL_BASE_URL = 'https://beavo-dental.web.app/legal';

// The documents exist in Portuguese, Spanish and English; the Spanish ones are machine-assisted translations of the Portuguese, pending native review.
const legalLocale = locale;

export const LEGAL_URLS = {
  terms: `${LEGAL_BASE_URL}/terms.${legalLocale}.html`,
  privacy: `${LEGAL_BASE_URL}/privacy-policy.${legalLocale}.html`,
} as const;

/** App Store id — fill in once the app exists in App Store Connect (until then More hides the review row). */
const APP_STORE_ID: string = '[APP_STORE_ID]';
export const REVIEW_URL = /^\d+$/.test(APP_STORE_ID) ? `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review` : null;
