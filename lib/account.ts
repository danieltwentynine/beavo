import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseError } from 'firebase/app';
import { EmailAuthProvider, deleteUser, reauthenticateWithCredential, signOut } from 'firebase/auth';
import { getDocumentAsync } from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';

import { errorCode, noteIfOffline, noteImportFailure } from '@/lib/errors';
import { auth, db } from '@/lib/firebase';
import { reauthenticateWithGoogle, signOutGoogle } from '@/lib/socialAuth';
import { dropOutboxForChild, dropOutboxForUser } from '@/lib/sync';
import { clearConsentRecord } from '@/lib/consent';
import { ownerIdOf, useAuthStore } from '@/stores/authStore';
import { clearSnapshot, useChildStore } from '@/stores/childStore';
import { useNoticeStore } from '@/stores/noticeStore';
import { deleteAllUserData, exportAllData, importBackup } from '@/src/data/account';
import { MAX_BACKUP_BYTES, parseBackup, type Backup } from '@/src/data/backup';
import { localDate } from '@/src/data/schedule';
import { deleteChild } from '@/src/data/children';
import { SERVER_TIMEOUT_MS } from '@/src/data/firestore';
import { LOCAL_UID, localBackup, localImport } from '@/src/data/local';
import { accountOp, createOpCoordinator, endSessionFor } from '@/src/data/pendingOps';

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
  } catch (error) {
    noteIfOffline(error);
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
  } catch (error) {
    noteImportFailure(error);
    return null;
  }
}

// ---- Operations that must finish (src/data/pendingOps.ts) ----
// The coordinator (pure, tested) persists each operation before its destructive
// step, runs it once at a time, pauses it for another signed-in account and
// re-runs it on launch, foreground and a retry timer. Here: the real storage,
// Firebase and notices.

let retryTimer: ReturnType<typeof setTimeout> | null = null;
const OP_RETRY_MS = 60_000;

/** Local data keyed to the deleted account `uid` only — never another parent's. */
async function cleanupAccountData(uid: string): Promise<void> {
  await clearSnapshot(uid);
  await clearConsentRecord(uid);
  await dropOutboxForUser(uid);
}

/** Session-wide teardown after `uid` was deleted; the coordinator calls it only when nobody or `uid` is signed in. */
const endSession = (uid: string): Promise<boolean> =>
  // Owner re-checked before and after the Google sign-out, right before the reset (src/data/pendingOps.ts).
  endSessionFor(uid, {
    currentOwner: () => auth.currentUser?.uid ?? null,
    signOutProvider: signOutGoogle,
    resetScreens: () => useChildStore.getState().reset(),
  });

const ops = createOpCoordinator({
  storage: AsyncStorage,
  currentOwner: () => auth.currentUser?.uid ?? null,
  deleteChildData: async (uid, childId) => {
    await deleteChild(db, uid, childId);
    await dropOutboxForChild(childId);
  },
  eraseAccountData: (uid, childIds) => deleteAllUserData(db, uid, SERVER_TIMEOUT_MS, childIds),
  deleteAuthUser: async (uid) => {
    const user = auth.currentUser;
    if (user?.uid !== uid) return false;
    await deleteUser(user);
    return true;
  },
  cleanupAccountData,
  endSession,
  errorCode,
  notify: (key, tone) => useNoticeStore.getState().show(key, tone),
  scheduleRetry,
});

function scheduleRetry(): void {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    const uid = ownerId();
    if (uid) void reconcilePendingOps(uid);
  }, OP_RETRY_MS);
}

/** Finish this owner's cut-off operations and tell the parent the real outcome (launch, foreground, timer). */
export async function reconcilePendingOps(uid: string): Promise<void> {
  if (uid === LOCAL_UID) return;
  await ops.reconcile(uid);
}

/**
 * Delete one child and everything under it. Needs a connection. true: done;
 * 'pending': cut off offline — it finishes by itself once online (the parent is
 * told then); false: refused or failed before anything was written.
 */
export async function deleteChildProfile(childId: string): Promise<boolean | 'pending'> {
  const uid = ownerId();
  if (!uid) return false;
  if (uid === LOCAL_UID) {
    try {
      await deleteChild(db, uid, childId);
    } catch {
      return false;
    }
    await dropOutboxForChild(childId);
    return true;
  }
  const result = await ops.run({ kind: 'deleteChild', uid, childId }).result;
  if (result === 'done' || result === 'doneQuietly') return true;
  if (result === 'retrying') {
    useNoticeStore.getState().show('notice.willFinish', 'info');
    return 'pending';
  }
  // notPersisted: nothing was started, so say it wasn't done rather than promise a retry.
  if (result === 'notPersisted') useNoticeStore.getState().show('notice.notSaved');
  return false;
}

export type DeleteAccountResult = 'deleted' | 'pending' | 'cancelled' | 'wrong-password' | 'error';

/**
 * Delete the account: reauthenticate FIRST (Firebase requires a recent login,
 * and doing it up front means a failure can't leave data half-deleted), then
 * every doc under users/{uid} (the erasure marker first), then the Auth user,
 * then local copies. 'pending': cut off offline after it started — the erasure
 * can't be undone, so it is finished by itself once online (the parent is told
 * now and when it is done). Email accounts pass the password just typed.
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
  } catch (error) {
    if (error instanceof FirebaseError && ['auth/wrong-password', 'auth/invalid-credential'].includes(error.code)) {
      return 'wrong-password';
    }
    noteIfOffline(error);
    return 'error';
  }
  // Known child ids are kept with the operation, so a resumed erasure also
  // empties a child whose document is already gone.
  const op = accountOp(user.uid, useChildStore.getState().children.map((c) => c.id));
  useChildStore.getState().freeze();
  const result = await ops.run(op).result;
  if (result === 'done' || result === 'doneQuietly') return 'deleted';
  // Saved and waiting (offline, or another account signed in after it was saved): it finishes later.
  if (result === 'retrying' || result === 'paused') {
    // Stays frozen: the profile is being erased; it finishes on reconnect (the parent is told then).
    useNoticeStore.getState().show('notice.willFinish', 'info');
    return 'pending';
  }
  useChildStore.setState({ frozen: false });
  if (result === 'signInNeeded') useNoticeStore.getState().show('notice.signInToFinish');
  // notPersisted / notStarted: nothing was saved or started, so no retry is promised.
  else useNoticeStore.getState().show('notice.notSaved');
  return 'error';
  return 'deleted';
}
