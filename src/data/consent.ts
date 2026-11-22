import { z } from 'zod';

import type { Consent, UserProfile } from '@/types';

/**
 * Consent bookkeeping (pure, for node --test; lib/consent.ts does the I/O).
 *
 * The device keeps a record of what the parent accepted here and whether the
 * server has confirmed it. A record that is current but not confirmed means
 * "accepted on this phone, still to reach the account": it is sent again until
 * the server has it, so a write lost offline (app killed) can't leave the
 * account without consent and every later child write silently refused.
 * A confirmed record the server no longer has means the consent (or the whole
 * account) was removed elsewhere: it is forgotten and the parent asked again —
 * never sent back, so a second phone can't revive an erased account.
 */
export interface LegalVersions {
  terms: string;
  privacy: string;
}

const localConsentSchema = z.object({
  termsVersion: z.string(),
  privacyVersion: z.string(),
  healthData: z.literal(true),
  confirmed: z.boolean(),
});

export type LocalConsent = z.infer<typeof localConsentSchema>;

/** Storage is untrusted: anything unexpected (incl. pre-2026-11-22 records without healthData) reads as none. */
export function parseLocalConsent(raw: string | null): LocalConsent | undefined {
  if (!raw) return undefined;
  try {
    const parsed = localConsentSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export const localConsentRecord = (versions: LegalVersions, confirmed: boolean): LocalConsent => ({
  termsVersion: versions.terms,
  privacyVersion: versions.privacy,
  healthData: true,
  confirmed,
});

/** Both of today's documents and the separate health-data item. */
export const isCurrentConsent = (
  consent: Pick<Consent, 'termsVersion' | 'privacyVersion' | 'healthData'> | undefined,
  versions: LegalVersions,
): boolean =>
  consent?.termsVersion === versions.terms && consent?.privacyVersion === versions.privacy && consent?.healthData === true;

/** 'pending': accepted on this phone, not confirmed by the server — never unlocks child data. */
export type ConsentStatusResult = 'ok' | 'needed' | 'updated' | 'pending';
export type ConsentAction = 'none' | 'resend' | 'markConfirmed' | 'forget';

/** What the server said: unreachable, or the stored profile (null: none). */
export type ServerConsentView = { reachable: false } | { reachable: true; profile: UserProfile | null };

export interface ConsentPlan {
  status: ConsentStatusResult;
  action: ConsentAction;
}

export function planConsentCheck(local: LocalConsent | undefined, server: ServerConsentView, versions: LegalVersions): ConsentPlan {
  const localCurrent = isCurrentConsent(local, versions);
  if (!server.reachable) {
    if (localCurrent) return local?.confirmed ? { status: 'ok', action: 'none' } : { status: 'pending', action: 'resend' };
    return { status: local ? 'updated' : 'needed', action: 'none' };
  }
  const stored = server.profile?.consent;
  if (isCurrentConsent(stored, versions)) return { status: 'ok', action: local?.confirmed && localCurrent ? 'none' : 'markConfirmed' };
  if (localCurrent && !local?.confirmed) return { status: 'pending', action: 'resend' };
  return { status: stored ? 'updated' : 'needed', action: local ? 'forget' : 'none' };
}

/** How a consent write (first send or re-send) ended. */
export type ConsentWriteOutcome = 'confirmed' | 'timeout' | 'refused';

/**
 * After a consent write: confirmed unlocks; a timeout stays pending (the device
 * record is kept for the re-send); a refusal drops the record and asks again.
 * `hadReceipt`: the server held an older consent (re-prompt as "updated").
 */
export function consentAfterWrite(outcome: ConsentWriteOutcome, hadReceipt: boolean): ConsentPlan {
  if (outcome === 'confirmed') return { status: 'ok', action: 'markConfirmed' };
  if (outcome === 'timeout') return { status: 'pending', action: 'none' };
  return { status: hadReceipt ? 'updated' : 'needed', action: 'forget' };
}
