import { useChildWatch, useChildWatchSnapshot } from '@/hooks/useChildWatch';
import { watchAllSessions } from '@/src/data/sessions';

/** Live brushing sessions of the active child (all dates). */
export const useSessions = () => useChildWatch(watchAllSessions);

/** Distinguishes loaded history from a listener still starting. */
export const useSessionHistory = () => useChildWatchSnapshot(watchAllSessions);
