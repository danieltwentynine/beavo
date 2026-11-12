import { FirebaseError } from 'firebase/app';
import { EmailAuthProvider, deleteUser, reauthenticateWithCredential, signOut } from 'firebase/auth';
import { getDocumentAsync } from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';

import { auth, db } from '@/lib/firebase';
import { reauthenticateWithGoogle, signOutGoogle } from '@/lib/socialAuth';
import { dropOutboxForChild, dropOutboxForUser } from '@/lib/sync';
import { clearConsentRecord } from '@/lib/consent';
import { ownerIdOf, useAuthStore } from '@/stores/authStore';
import { clearSnapshot, useChildStore } from '@/stores/childStore';
import { deleteAllUserData, exportAllData, importBackup } from '@/src/data/account';
import { MAX_BACKUP_BYTES, parseBackup, type Backup } from '@/src/data/backup';
import { localDate } from '@/src/data/schedule';
import { deleteChild } from '@/src/data/children';
import { LOCAL_UID, localBackup, localImport } from '@/src/data/local';

const ownerId = () => ownerIdOf(useAuthStore.getState());

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

/**
 * Export all of the parent's data as a .json backup file through the share
 * sheet. Needs a connection, except without an account, where the data is
 * already on the device. The temporary file is deleted once the sheet closes.
 */
export async function shareDataExport(): Promise<boolean> {
  const user = auth.currentUser;
  const uid = ownerId();
  if (!uid) return false;
  const file = new File(Paths.cache, `beavo-backup-${localDate(new Date())}.json`);
  try {
    // Sign-in data lives in Firebase Auth, not Firestore — include it so the export is complete.
    const account = user ? { email: user.email ?? null, displayName: user.displayName ?? null, providers: user.providerData.map((p) => p.providerId) } : null;
    const data =
      uid === LOCAL_UID || !user
        ? { ...(await localBackup()), exportedAt: new Date().toISOString() }
        : { ...(await exportAllData(db, uid)), account };
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify(data, null, 2));
    await shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' });
    return true;
  } catch {
    return false;
  } finally {
    try {
      if (file.exists) file.delete();
    } catch {
      // The cache directory is cleared by the system anyway.
    }
  }
}

export type PickedBackup = { status: 'picked'; backup: Backup } | { status: 'cancelled' } | { status: 'invalid' };

/** Let the parent pick a backup .json in Files and validate it (nothing is written yet). */
export async function pickBackup(): Promise<PickedBackup> {
  try {
    const result = await getDocumentAsync({ type: ['application/json', 'public.json', 'text/plain'], copyToCacheDirectory: true });
    if (result.canceled) return { status: 'cancelled' };
    const file = new File(result.assets[0].uri);
    try {
      if (file.size > MAX_BACKUP_BYTES) return { status: 'invalid' };
      const backup = parseBackup(await file.text());
      return backup ? { status: 'picked', backup } : { status: 'invalid' };
    } finally {
      // The picker's copy holds children's data: never leave it in the cache.
      try {
        if (file.exists) file.delete();
      } catch {
        // Cleared by cleanupBackupFiles on the next launch.
      }
    }
  } catch {
    return { status: 'invalid' };
  }
}

/**
 * Remove backup copies a killed app left in the cache (an export whose share
 * sheet never closed). Called once at launch.
 */
export function cleanupBackupFiles(): void {
  try {
    for (const item of Paths.cache.list()) {
      if (item instanceof File && item.name.startsWith('beavo-backup-')) item.delete();
    }
  } catch {
    // Best effort; the system clears the cache too.
  }
}

/** Merge a validated backup into this account (needs a connection) or, without one, into this device. Returns records written, or null on failure. */
export async function restoreBackup(backup: Backup): Promise<number | null> {
  const uid = ownerId();
  if (!uid) return null;
  try {
    return uid === LOCAL_UID ? await localImport(backup) : await importBackup(db, uid, backup);
  } catch {
    return null;
  }
}

/** Delete one child and everything under it. Needs a connection. */
export async function deleteChildProfile(childId: string): Promise<boolean> {
  const uid = ownerId();
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
