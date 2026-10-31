import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from 'firebase/auth';

import { db } from '@/lib/firebase';
import { locale, t, type StringKey } from '@/lib/i18n';
import { LEGAL_VERSIONS } from '@/lib/legal';
import type { ConsentStatus } from '@/stores/authStore';
import { fetchUserProfile, saveConsent } from '@/src/data/account';
import { background } from '@/src/data/firestore';
import { DEFAULT_CATEGORIES, seedDefaultCategories } from '@/src/data/toothEvents';
import type { UserProfile } from '@/types';

// Local copy of the accepted versions, so an offline launch doesn't re-prompt.
const localKey = (uid: string) => `zing.consent.v1.${uid}`;

const isCurrent = (v: { termsVersion?: string; privacyVersion?: string } | undefined) =>
  v?.termsVersion === LEGAL_VERSIONS.terms && v?.privacyVersion === LEGAL_VERSIONS.privacy;

async function readLocal(uid: string): Promise<{ termsVersion?: string; privacyVersion?: string } | undefined> {
  try {
    const raw = await AsyncStorage.getItem(localKey(uid));
    const parsed: unknown = raw ? JSON.parse(raw) : undefined;
    return parsed && typeof parsed === 'object' ? (parsed as { termsVersion?: string; privacyVersion?: string }) : undefined;
  } catch {
    return undefined;
  }
}

async function writeLocal(uid: string): Promise<void> {
  try {
    await AsyncStorage.setItem(
      localKey(uid),
      JSON.stringify({ termsVersion: LEGAL_VERSIONS.terms, privacyVersion: LEGAL_VERSIONS.privacy }),
    );
  } catch {
    // Only costs a re-check against the server next launch.
  }
}

/** Forget this parent's local consent record (account deletion). */
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

/** Has this parent accepted the current Terms and Privacy Policy? */
export async function checkConsent(uid: string): Promise<Exclude<ConsentStatus, 'unknown'>> {
  const local = await readLocal(uid);
  if (isCurrent(local)) return 'ok';
  try {
    const consent = (await fetchUserProfile(db, uid))?.consent;
    if (!consent) return 'needed';
    if (isCurrent(consent)) {
      await writeLocal(uid);
      return 'ok';
    }
    return 'updated';
  } catch {
    // Offline and nothing current on this device: ask (accepting works offline).
    return local ? 'updated' : 'needed';
  }
}

/** Record acceptance of the current versions. Works offline; syncs on reconnect. */
export async function acceptConsent(user: User): Promise<void> {
  let existing: UserProfile | null | undefined;
  try {
    existing = await fetchUserProfile(db, user.uid);
  } catch {
    existing = undefined; // offline: can't tell if the account is new
  }
  background(
    saveConsent(db, user.uid, {
      displayName: user.displayName ?? '',
      locale,
      termsVersion: LEGAL_VERSIONS.terms,
      privacyVersion: LEGAL_VERSIONS.privacy,
      createdAt: existing?.createdAt,
    }),
  );
  // Only a confirmed-new account gets the default categories, so re-consenting
  // never overwrites categories the parent edited.
  if (existing === null) seedCategories(user.uid);
  await writeLocal(user.uid);
}
