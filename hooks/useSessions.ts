import { useChildWatch, useChildWatchSnapshot } from '@/hooks/useChildWatch';
import { watchAllSessions } from '@/src/data/sessions';

/** Live brushing sessions of the active child (all dates). */
export const useSessions = () => useChildWatch(watchAllSessions);

/** Includes the last confirmed count, distinct from a still-loading history. */
export const useSessionHistory = () => useChildWatchSnapshot(watchAllSessions);
