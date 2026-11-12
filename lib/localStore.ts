import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ChildProfile } from '@/types';
import {
  LOCAL_CHILD_KEY,
  LOCAL_MODE_KEY,
  LOCAL_SESSIONS_KEY,
  decodeChild,
  encodeChild,
} from '@/lib/localData';
import { decodeOutbox, type PendingSession } from '@/lib/outbox';

/** AsyncStorage side of device-only mode — see `lib/localData.ts`. */

export async function isLocalMode(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(LOCAL_MODE_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setLocalMode(on: boolean): Promise<void> {
  if (on) await AsyncStorage.setItem(LOCAL_MODE_KEY, '1');
  else await AsyncStorage.removeItem(LOCAL_MODE_KEY);
}

/** Throws if storage can't be read, so callers can tell that apart from "no child". */
export async function readLocalChild(): Promise<ChildProfile | null> {
  return decodeChild(await AsyncStorage.getItem(LOCAL_CHILD_KEY));
}

export async function writeLocalChild(child: ChildProfile): Promise<void> {
  await AsyncStorage.setItem(LOCAL_CHILD_KEY, encodeChild(child));
}

/** A device session has the outbox's JSON-safe shape, so it shares its decoder. */
export async function readLocalSessions(): Promise<PendingSession[]> {
  return decodeOutbox(await AsyncStorage.getItem(LOCAL_SESSIONS_KEY));
}

// ponytail: the whole history is one JSON value, rewritten per session. At two
// sessions a day that is ~200 KB a year; move to one key per month if it bites.
export async function addLocalSession(session: PendingSession): Promise<void> {
  const others = (await readLocalSessions()).filter((s) => s.id !== session.id);
  await AsyncStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify([...others, session]));
}

export async function clearLocalData(): Promise<void> {
  await AsyncStorage.multiRemove([LOCAL_CHILD_KEY, LOCAL_SESSIONS_KEY, LOCAL_MODE_KEY]);
}
