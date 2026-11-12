import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearConsentRecord } from '@/lib/consent';
import { db } from '@/lib/firebase';
import { dropOutboxForUser } from '@/lib/sync';
import { useAuthStore } from '@/stores/authStore';
import { importBackup } from '@/src/data/account';
import { parseBackup } from '@/src/data/backup';
import { LOCAL_DATA_KEY, LOCAL_UID, hydrateLocal, localBackup, localClear } from '@/src/data/local';

/**
 * App side of device-only mode (ADR 0005): where the store in src/data/local.ts
 * is kept, whether this phone is used without an account, and the two ways out
 * of it — moving the data into an account, or erasing it.
 */
const LOCAL_MODE_KEY = 'beavo.localMode.v1';

/**
 * Read the device data (at launch, and again on return to the foreground until
 * it works). If storage can't be read the store is left unstarted on purpose:
 * starting it empty would let the next save overwrite real data. Data that is
 * there but unreadable is set aside, not lost.
 */
export async function startLocalStore(): Promise<void> {
  if (started) return;
  try {
    const text = await AsyncStorage.getItem(LOCAL_DATA_KEY);
    // Unreadable data (e.g. written by a newer app version) is set aside BEFORE
    // the store starts empty and can save over it. The first copy set aside is
    // kept: a later failure must not replace the one worth recovering.
    if (text && !parseBackup(text) && !(await AsyncStorage.getItem(UNREADABLE_KEY))) {
      await AsyncStorage.setItem(UNREADABLE_KEY, text);
    }
    if (started) return;
    hydrateLocal(text, (next) => AsyncStorage.setItem(LOCAL_DATA_KEY, next));
    started = true;
  } catch {
    // Not started: called again when the app returns to the foreground.
  }
}

let started = false;
const UNREADABLE_KEY = `${LOCAL_DATA_KEY}.unreadable`;

export async function isLocalMode(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(LOCAL_MODE_KEY)) === '1';
  } catch {
    return false;
  }
}

/** Start using this phone without an account. False if the choice couldn't be saved. */
export async function enterLocalMode(): Promise<boolean> {
  try {
    await AsyncStorage.setItem(LOCAL_MODE_KEY, '1');
  } catch {
    return false;
  }
  useAuthStore.getState().setLocal(true);
  return true;
}

/** Stop using this phone without an account. The data stays until moved or erased. */
export async function leaveLocalMode(): Promise<void> {
  await AsyncStorage.removeItem(LOCAL_MODE_KEY).catch(() => undefined);
  useAuthStore.getState().setLocal(false);
}

/** First names of the children kept on this device (empty when there are none). */
export async function localChildNames(): Promise<string[]> {
  return (await localBackup()).children.map((c) => c.name);
}

async function forgetLocalData(): Promise<void> {
  await localClear();
  await clearConsentRecord(LOCAL_UID);
  await dropOutboxForUser(LOCAL_UID);
  await leaveLocalMode();
}

/** Erase every child, slot, session, tooth record and category kept on this device. */
export async function eraseLocalData(): Promise<boolean> {
  try {
    await forgetLocalData();
    // Erasing means everything, including a copy set aside as unreadable. A move
    // to an account keeps that copy: it was never moved.
    await AsyncStorage.removeItem(UNREADABLE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Move everything on this device into the signed-in parent's account, then
 * remove it from the device. Merges by id (importBackup), so a retry after a
 * failure can't duplicate anything, and the device copy is only removed once
 * the account has confirmed every write. Needs a connection.
 */
export async function moveLocalDataToAccount(uid: string): Promise<boolean> {
  try {
    await importBackup(db, uid, await localBackup());
    await forgetLocalData();
    return true;
  } catch {
    return false;
  }
}
