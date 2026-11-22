import AsyncStorage from '@react-native-async-storage/async-storage';

import { auth, db } from '@/lib/firebase';
import { locale, t, type StringKey } from '@/lib/i18n';
import { LEGAL_VERSIONS } from '@/lib/legal';
import { ownerIdOf, useAuthStore, type ConsentStatus } from '@/stores/authStore';
import { useNoticeStore } from '@/stores/noticeStore';
import { fetchUserProfile, saveConsent } from '@/src/data/account';
import {
  consentAfterWrite,
  isCurrentConsent,
  localConsentRecord,
  parseLocalConsent,
  planConsentCheck,
  type ConsentPlan,
  type ConsentStatusResult,
  type LocalConsent,
  type ServerConsentView,
} from '@/src/data/consent';
import { ServerTimeoutError, background, withTimeout } from '@/src/data/firestore';
import { LOCAL_UID } from '@/src/data/local';
import { DEFAULT_CATEGORIES, seedDefaultCategories } from '@/src/data/toothEvents';
import type { UserProfile } from '@/types';

/**
 * Consent I/O; the decisions are pure in src/data/consent.ts. The device record
 * says what this parent accepted here and whether the server has confirmed it,
 * so an offline launch doesn't re-prompt and a consent lost offline is sent
 * again (never silently missing on the account). Only a server-confirmed
 * consent unlocks the app ('ok'); an unconfirmed one is 'pending'.
 */

// v2: adds the separate health-data item and the confirmed flag (v1 records ask again).
const localKey = (uid: string) => `beavo.consent.v2.${uid}`;

/** How long to wait for the server before treating it as unreachable (also bounds a consent write). */
const SERVER_WAIT_MS = 8_000;

async function readLocal(uid: string): Promise<LocalConsent | undefined> {
  try {
    return parseLocalConsent(await AsyncStorage.getItem(localKey(uid)));
  } catch {
    return undefined;
  }
}

async function writeLocal(uid: string, confirmed: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(localKey(uid), JSON.stringify(localConsentRecord(LEGAL_VERSIONS, confirmed)));
  } catch {
    // Only costs a re-check against the server next launch.
  }
}

/** Forget this parent's local consent record (account deletion, consent removed elsewhere). */
export async function clearConsentRecord(uid: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(localKey(uid));
  } catch {
    // Nothing else to do.
  }
}

/** Write the default categories with names in the app language. */
export function seedCategories(uid: string): void {
  const names = Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [c.id, t(`category.${c.id}` as StringKey)]));
  background(seedDefaultCategories(db, uid, names));
}

const consentWrite = (uid: string, existing: UserProfile | null | undefined) =>
  saveConsent(db, uid, {
    displayName: auth.currentUser?.uid === uid ? (auth.currentUser.displayName ?? '') : '',
    locale,
    termsVersion: LEGAL_VERSIONS.terms,
    privacyVersion: LEGAL_VERSIONS.privacy,
    existing,
  });

async function askServer(uid: string): Promise<ServerConsentView> {
  try {
    return { reachable: true, profile: await withTimeout(fetchUserProfile(db, uid), 'consent check', SERVER_WAIT_MS) };
  } catch {
    return { reachable: false };
  }
}

/** A later answer from the server corrects the status, if this parent is still the one on screen. */
function applyLate(uid: string, status: ConsentStatusResult): void {
  const state = useAuthStore.getState();
  if (ownerIdOf(state) === uid && state.consent !== status) state.setConsent(status);
}

async function apply(uid: string, plan: ConsentPlan): Promise<ConsentStatusResult> {
  if (plan.action === 'markConfirmed') await writeLocal(uid, true);
  else if (plan.action === 'forget') await clearConsentRecord(uid);
  return plan.status;
}

/**
 * Wait (bounded) for a consent write. Confirmed → 'ok'. Refused → the device
 * record is dropped and the parent asked again. Timed out → 'pending': the
 * record is kept, and the queued write keeps being watched, so the status
 * becomes 'ok' (or the refusal) by itself once the phone is online.
 */
async function settle(uid: string, write: Promise<void>, hadReceipt: boolean): Promise<ConsentStatusResult> {
  try {
    await withTimeout(write, 'save consent', SERVER_WAIT_MS);
  } catch (error) {
    if (error instanceof ServerTimeoutError) {
      write.then(
        () => void apply(uid, consentAfterWrite('confirmed', hadReceipt)).then((status) => applyLate(uid, status)),
        () => void refused(uid, hadReceipt).then((status) => applyLate(uid, status)),
      );
      return 'pending';
    }
    return refused(uid, hadReceipt);
  }
  return apply(uid, consentAfterWrite('confirmed', hadReceipt));
}

async function refused(uid: string, hadReceipt: boolean): Promise<ConsentStatusResult> {
  useNoticeStore.getState().show('consent.saveFailed');
  return apply(uid, consentAfterWrite('refused', hadReceipt));
}

async function verifyWithServer(uid: string, local: LocalConsent | undefined): Promise<ConsentStatusResult> {
  const server = await askServer(uid);
  const plan = planConsentCheck(local, server, LEGAL_VERSIONS);
  if (plan.action !== 'resend') return apply(uid, plan);
  // Still pending: send it again and let the outcome correct the status later.
  const profile = server.reachable ? server.profile : undefined;
  void settle(uid, consentWrite(uid, profile), Boolean(profile?.consent)).then((status) => applyLate(uid, status));
  return 'pending';
}

/**
 * Has this parent accepted the current Terms, Privacy Policy and health-data
 * item, confirmed by the server? A confirmed device record answers at once
 * (offline launch) and the server check runs behind it. An unconfirmed one is
 * 'pending' (consent screen, no child data) and is sent again.
 */
export async function checkConsent(uid: string): Promise<Exclude<ConsentStatus, 'unknown'>> {
  const local = await readLocal(uid);
  // Without an account the acceptance is recorded on this device only.
  if (uid === LOCAL_UID) return isCurrentConsent(local, LEGAL_VERSIONS) ? 'ok' : local ? 'updated' : 'needed';
  if (isCurrentConsent(local, LEGAL_VERSIONS) && local?.confirmed) {
    void verifyWithServer(uid, local).then((status) => applyLate(uid, status));
    return 'ok';
  }
  return verifyWithServer(uid, local);
}

/**
 * Record acceptance of the current versions and the health-data item.
 * 'ok': the server confirmed. 'pending': offline or slow — kept on this phone,
 * re-sent until confirmed, and the status turns 'ok' by itself when it lands.
 * 'needed' / 'updated': the server refused it (nothing kept on the device).
 * Without an account (`LOCAL_UID`) it is recorded on this device only.
 */
export async function acceptConsent(user: { uid: string }): Promise<ConsentStatusResult> {
  if (user.uid === LOCAL_UID) {
    // Seeding only adds missing defaults, so re-consenting keeps the parent's edits.
    seedCategories(LOCAL_UID);
    await writeLocal(LOCAL_UID, true);
    return 'ok';
  }
  const server = await askServer(user.uid);
  const existing = server.reachable ? server.profile : undefined;
  // Accepted on this phone: kept as unconfirmed first, so an app kill can't lose it.
  await writeLocal(user.uid, false);
  const write = consentWrite(user.uid, existing);
  // Only a confirmed-new account gets the default categories (queued after the
  // consent write), so re-consenting never overwrites categories the parent edited.
  if (existing === null) seedCategories(user.uid);
  return settle(user.uid, write, Boolean(existing?.consent));
}
