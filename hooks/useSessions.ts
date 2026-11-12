import { useChildWatch } from '@/hooks/useChildWatch';
import { watchAllSessions } from '@/src/data/sessions';

/** Live brushing sessions of the active child (all dates). */
export const useSessions = () => useChildWatch(watchAllSessions);
