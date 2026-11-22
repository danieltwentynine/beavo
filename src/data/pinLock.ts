/**
 * Wrong-PIN wait for the grown-ups check (pure). The first tries are free; from
 * the 5th wrong PIN in a row each wrong one makes the next try wait, doubling
 * from 1 minute up to about an hour, so guessing 10,000 PINs is not practical.
 */
export interface PinLock {
  fails: number;
  /** Epoch ms before which no PIN is accepted; 0 when not waiting. */
  lockedUntil: number;
}

export const NO_LOCK: PinLock = { fails: 0, lockedUntil: 0 };
const FREE_TRIES = 4;
const MINUTE = 60_000;
const MAX_WAIT = 64 * MINUTE;

// ponytail: trusts the phone's clock, so setting the clock forward ends a wait
// early (one extra guess per change). Use a monotonic clock if that matters.
export const isLocked = (lock: PinLock, now: number): boolean => now < lock.lockedUntil;

export function afterWrongPin(lock: PinLock, now: number): PinLock {
  const fails = lock.fails + 1;
  const wait = fails > FREE_TRIES ? Math.min(MINUTE * 2 ** (fails - FREE_TRIES - 1), MAX_WAIT) : 0;
  return { fails, lockedUntil: wait ? now + wait : 0 };
}

export const isPinLock = (v: unknown): v is PinLock =>
  typeof v === 'object' &&
  v !== null &&
  Number.isInteger((v as PinLock).fails) &&
  (v as PinLock).fails >= 0 &&
  Number.isFinite((v as PinLock).lockedUntil);

// ---- Which stored PIN to trust at launch ----

/** The Keychain read: a 4-digit PIN, nothing stored, or the read failed. */
export type KeychainRead = { kind: 'pin'; pin: string } | { kind: 'none' } | { kind: 'error' };

/** The settings read: nothing stored yet (this install's first launch), a stored object, or the read failed. */
export type SettingsRead = { kind: 'empty' } | { kind: 'saved' } | { kind: 'error' };

export interface StoredPin {
  pin: string | null;
  hasPin: boolean;
  /** A PIN was chosen but the Keychain can't be read now: treat it as existing (no first-time setup). */
  pinUnreadable: boolean;
  /** Delete the Keychain PIN: it was left by an earlier install of the app. */
  dropKeychain: boolean;
}

/**
 * The Keychain outlives the app, so a PIN found on the FIRST launch of an
 * install (no settings stored yet) belongs to an earlier install and is
 * dropped. Otherwise a valid Keychain PIN is authoritative: a failed settings
 * read or a missing hasPin marker never wipes it.
 */
export function resolveStoredPin(keychain: KeychainRead, settings: SettingsRead, savedHasPin: boolean): StoredPin {
  if (keychain.kind === 'pin') {
    if (settings.kind === 'empty') return { pin: null, hasPin: false, pinUnreadable: false, dropKeychain: true };
    return { pin: keychain.pin, hasPin: true, pinUnreadable: false, dropKeychain: false };
  }
  if (keychain.kind === 'error') {
    // Can't tell: if this install chose a PIN (or settings are unreadable too), don't offer first-time setup.
    const maybeSet = settings.kind === 'error' || savedHasPin;
    return { pin: null, hasPin: maybeSet, pinUnreadable: maybeSet, dropKeychain: false };
  }
  return { pin: null, hasPin: false, pinUnreadable: false, dropKeychain: false };
}
