import { useChildWatch } from '@/hooks/useChildWatch';
import { watchToothEvents } from '@/src/data/toothEvents';

/** Live tooth events of the active child (all dates). */
export const useToothEvents = () => useChildWatch(watchToothEvents);
