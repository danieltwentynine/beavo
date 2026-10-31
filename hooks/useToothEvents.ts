import { useEffect, useState } from 'react';

import { useActiveChild } from '@/hooks/useActiveChild';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/authStore';
import { watchToothEvents } from '@/src/data/toothEvents';
import type { ToothEvent } from '@/types';

const NONE: ToothEvent[] = [];

/** Live tooth events of the active child (all dates). */
export function useToothEvents(): ToothEvent[] {
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const { child } = useActiveChild();
  const childId = child?.id ?? null;
  const key = uid && childId ? `${uid}/${childId}` : null;
  const [watched, setWatched] = useState<{ key: string; events: ToothEvent[] } | null>(null);

  useEffect(() => {
    if (!uid || !childId || !key) return;
    return watchToothEvents(db, uid, childId, (events) => setWatched({ key, events }));
  }, [uid, childId, key]);

  // Another child's events never flash while the new listener starts.
  return watched && watched.key === key ? watched.events : NONE;
}
