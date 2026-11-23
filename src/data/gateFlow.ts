/**
 * Grown-ups check decisions (pure, for node --test; components/ui/ParentalGate.tsx
 * renders them). The rule that matters: an existing PIN is replaced only after
 * the phone confirms its owner (Face ID / passcode). The written multiplication
 * question is a fallback for FIRST-TIME setup on a phone confirmed to have no
 * passcode only — a child who can multiply must never get to replace a PIN.
 * An authentication error fails closed: try again, no question.
 *
 * `pinExists` is true when a PIN is set, or when the Keychain couldn't be read
 * but settings say one was chosen (stores/settingsStore.ts `pinUnreadable`).
 */

/**
 * - `check` (default): the PIN; a phone without one chooses it first.
 * - `choosePin`: confirm the phone's owner, then choose a new PIN (Settings).
 */
export type GateMode = 'check' | 'choosePin';

export type GateStep = 'pin' | 'owner' | 'math' | 'create' | 'confirm';

/** What confirming the phone's owner returned. */
export type OwnerCheck = 'success' | 'cancelled' | 'noPasscode' | 'error';

/**
 * `blocked`: stay on the owner step and explain that replacing the PIN needs the phone's owner.
 * `retry`: the owner check failed with an error; stay on it and ask to try again.
 */
export type GateNext = GateStep | 'pass' | 'blocked' | 'retry' | 'stay';

export function firstGateStep(mode: GateMode, pinExists: boolean): GateStep {
  if (mode === 'choosePin') return 'owner';
  return pinExists ? 'pin' : 'owner';
}

export function afterOwnerCheck(outcome: OwnerCheck, pinExists: boolean): GateNext {
  if (outcome === 'success') return 'create';
  if (outcome === 'cancelled') return 'stay';
  // An error is not evidence of a phone without a passcode: fail closed.
  if (outcome === 'error') return 'retry';
  // Confirmed no passcode: only first-time setup may fall back to the question.
  return pinExists ? 'blocked' : 'math';
}

export function afterRightAnswer(pinExists: boolean): GateNext {
  if (pinExists) return 'blocked';
  return 'create';
}
