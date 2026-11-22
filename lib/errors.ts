import { FirebaseError } from 'firebase/app';

import { useNoticeStore, type StaleSource } from '@/stores/noticeStore';
import { ServerTimeoutError } from '@/src/data/firestore';

/**
 * Turns failures into parent-facing notices (stores/noticeStore.ts). Only an
 * error code is logged, in development — never names, data or tokens.
 */
const code = (error: unknown): string =>
  error instanceof ServerTimeoutError ? error.code : error instanceof FirebaseError ? error.code : 'unknown';

function devLog(what: string, error: unknown): void {
  if (__DEV__) console.warn(`[beavo] ${what}: ${code(error)}`);
}

/** A write fired with `background()` was refused or failed (registered in lib/firebase.ts). */
export function reportWriteError(error: unknown): void {
  devLog('write failed', error);
  useNoticeStore.getState().show('notice.notSaved');
}

/** A live listener stopped; its data is stale until the retry succeeds. */
export function reportListenerError(source: StaleSource, error: unknown): void {
  devLog(`listener ${source} failed`, error);
  const notices = useNoticeStore.getState();
  notices.setStale(source, true);
  notices.show('notice.notLoaded');
}

export const clearStale = (source: StaleSource): void => useNoticeStore.getState().setStale(source, false);

/** The error's code for classification (src/data/pendingOps.ts classifyOpError): Firebase/Auth codes, 'deadline-exceeded' for our timeout. */
export const errorCode = (error: unknown): string | undefined =>
  error instanceof ServerTimeoutError ? error.code : error instanceof FirebaseError ? error.code : undefined;

/** A step that needs the server (delete, import, export) could not reach it. */
export const isOfflineError = (error: unknown): boolean =>
  error instanceof ServerTimeoutError ||
  (error instanceof FirebaseError &&
    (error.code === 'unavailable' || error.code === 'deadline-exceeded' || error.code === 'auth/network-request-failed' || error.code === 'auth/timeout'));

/** Offline before anything was written (the connection check failed): a plain "needs a connection". */
export const failedBeforeWriting = (error: unknown): boolean =>
  (error instanceof ServerTimeoutError && error.step === 'connection check') || (error instanceof FirebaseError && error.code === 'unavailable');

/** When `error` means the server couldn't be reached, tell the parent this step needs a connection. */
export function noteIfOffline(error: unknown): void {
  if (isOfflineError(error)) useNoticeStore.getState().show('notice.needsConnection');
}

/**
 * An import (merge by id) cut off midway: some batches may still land. The
 * honest outcome is "didn't finish, run it again" — a re-run can't duplicate.
 */
export function noteImportFailure(error: unknown): void {
  if (!isOfflineError(error)) return;
  useNoticeStore.getState().show(failedBeforeWriting(error) ? 'notice.needsConnection' : 'notice.importInterrupted');
}

/** Retry delay after the n-th failure in a row (5 s, 15 s, 45 s, then every 2 min). */
export const retryDelayMs = (failures: number): number => Math.min(5_000 * 3 ** Math.max(0, failures - 1), 120_000);
