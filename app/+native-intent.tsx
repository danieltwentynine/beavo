/**
 * Every incoming URL (zing://…, universal links) opens the app's start screen,
 * never a deep screen. Zing has no deep-link features, and parent screens
 * (categories, settings, slots, child-form…) must only be reached through the
 * in-app parental gate (Apple Kids Category). Google Sign-In's own URL scheme
 * is handled natively by its SDK and never reaches the router.
 */
export function redirectSystemPath(_event: { path: string; initial: boolean }): string {
  return '/';
}
