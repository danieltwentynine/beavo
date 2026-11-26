/**
 * Where the app opens (pure, for node --test; app/index.tsx renders it).
 * - Still reading auth or the saved settings → wait (show nothing; the logo
 *   screen covers it).
 * - An owner (signed-in parent, or this phone without an account) → the tabs,
 *   landing on Escovação (kid mode included).
 * - No owner, first launch (intro never finished) → the intro.
 * - No owner, intro already seen → welcome (sign up / sign in / no account).
 */
export type LaunchRoute = '/(tabs)/brushing' | '/onboarding/intro' | '/onboarding/welcome';

export interface LaunchState {
  authLoading: boolean;
  settingsLoaded: boolean;
  ownerId: string | null;
  introSeen: boolean;
}

export function launchRoute({ authLoading, settingsLoaded, ownerId, introSeen }: LaunchState): LaunchRoute | null {
  if (authLoading || !settingsLoaded) return null;
  if (ownerId) return '/(tabs)/brushing';
  return introSeen ? '/onboarding/welcome' : '/onboarding/intro';
}

/**
 * The persisted "intro seen" mark from saved settings. Storage is untrusted:
 * only a literal `true` counts, so anything missing or malformed shows the
 * intro again (harmless) rather than skipping it.
 */
export function introSeenFromSaved(saved: unknown): boolean {
  return typeof saved === 'object' && saved !== null && (saved as { introSeen?: unknown }).introSeen === true;
}
