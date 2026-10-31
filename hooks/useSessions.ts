import { useEffect, useState } from 'react';

import { useActiveChild } from '@/hooks/useActiveChild';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/authStore';
import { watchAllSessions } from '@/src/data/sessions';
import type { BrushingSession } from '@/types';

const NONE: BrushingSession[] = [];

/** Live brushing sessions of the active child (all dates). */
export function useSessions(): BrushingSession[] {
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const { child } = useActiveChild();
  const childId = child?.id ?? null;
  const key = uid && childId ? `${uid}/${childId}` : null;
  const [watched, setWatched] = useState<{ key: string; sessions: BrushingSession[] } | null>(null);

  useEffect(() => {
    if (!uid || !childId || !key) return;
    return watchAllSessions(db, uid, childId, (sessions) => setWatched({ key, sessions }));
  }, [uid, childId, key]);

  return watched && watched.key === key ? watched.sessions : NONE;
}
