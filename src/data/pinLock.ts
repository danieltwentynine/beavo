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
