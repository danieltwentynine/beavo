import { FirebaseError } from 'firebase/app';
import { EmailAuthProvider, deleteUser, reauthenticateWithCredential, signOut } from 'firebase/auth';
import { Share } from 'react-native';

import { auth, db } from '@/lib/firebase';
import { t } from '@/lib/i18n';
import { reauthenticateWithGoogle, signOutGoogle } from '@/lib/socialAuth';
import { dropOutboxForChild, dropOutboxForUser } from '@/lib/sync';
import { clearConsentRecord } from '@/lib/consent';
import { clearSnapshot, useChildStore } from '@/stores/childStore';
import { deleteAllUserData, exportAllData } from '@/src/data/account';
import { deleteChild } from '@/src/data/children';

/**
 * Sign the parent out. The on-device child snapshot is cleared by the auth
 * listener in app/_layout.tsx (that also covers a session ended elsewhere, e.g.
 * account deleted on another device). Unconfirmed sessions stay in the outbox
 * (no names in it) and sync at the next sign-in.
 */
export async function signOutParent(): Promise<boolean> {
  try {
    await signOut(auth);
  } catch {
    return false;
  }
  await signOutGoogle();
  return true;
}

/** How this parent re-proves their identity before deleting the account. */
export function reauthMethod(): 'google' | 'password' | null {
  const providers = auth.currentUser?.providerData.map((p) => p.providerId) ?? [];
  if (providers.includes('google.com')) return 'google';
  if (providers.includes('password')) return 'password';
  return null;
}

/** Export all of the parent's data as JSON through the share sheet. Needs a connection. */
export async function shareDataExport(): Promise<boolean> {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  try {
    const user = auth.currentUser;
    // Sign-in data lives in Firebase Auth, not Firestore — include it so the export is complete.
    const account = { email: user?.email ?? null, displayName: user?.displayName ?? null, providers: user?.providerData.map((p) => p.providerId) ?? [] };
    const data = { account, ...(await exportAllData(db, uid)) };
    // ponytail: shared as text; switch to a .json file via expo-sharing if parents ask for an attachment.
    await Share.share({ title: t('more.exportTitle'), message: JSON.stringify(data, null, 2) });
    return true;
  } catch {
    return false;
  }
}

/** Delete one child and everything under it. Needs a connection. */
export async function deleteChildProfile(childId: string): Promise<boolean> {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  try {
    await deleteChild(db, uid, childId);
  } catch {
    return false;
  }
  await dropOutboxForChild(childId);
  return true;
}

export type DeleteAccountResult = 'deleted' | 'cancelled' | 'wrong-password' | 'error';

/**
 * Delete the account: reauthenticate FIRST (Firebase requires a recent login,
 * and doing it up front means a failure can't leave data half-deleted), then
 * every doc under users/{uid}, then the Auth user, then local copies.
 * Email accounts pass the password the parent just typed.
 */
export async function deleteParentAccount(password?: string): Promise<DeleteAccountResult> {
  const user = auth.currentUser;
  if (!user) return 'error';
  const method = reauthMethod();
  // No way to reauthenticate → stop before touching any data.
  if (!method) return 'error';
  try {
    if (method === 'google') {
      if ((await reauthenticateWithGoogle(user)) === 'cancelled') return 'cancelled';
    } else {
      if (!password || !user.email) return 'cancelled';
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    }
    useChildStore.getState().freeze();
    await deleteAllUserData(db, user.uid);
    await deleteUser(user);
  } catch (error) {
    useChildStore.setState({ frozen: false });
    if (error instanceof FirebaseError && ['auth/wrong-password', 'auth/invalid-credential'].includes(error.code)) {
      return 'wrong-password';
    }
    return 'error';
  }
  await signOutGoogle();
  await clearSnapshot(user.uid);
  await clearConsentRecord(user.uid);
  await dropOutboxForUser(user.uid);
  useChildStore.getState().reset();
  return 'deleted';
}
