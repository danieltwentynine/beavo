import { useEffect, useState } from 'react';

import { useActiveChild } from '@/hooks/useActiveChild';
import { db } from '@/lib/firebase';
import { ownerIdOf, useAuthStore } from '@/stores/authStore';

type Watch<T> = (database: typeof db, uid: string, childId: string, onChange: (items: T[]) => void) => () => void;

const NONE: never[] = [];

/** Live items of the active child from one of the `watch*` repository listeners. */
export function useChildWatch<T>(watch: Watch<T>): T[] {
  const uid = useAuthStore(ownerIdOf);
  const { child } = useActiveChild();
  const childId = child?.id ?? null;
  const key = uid && childId ? `${uid}/${childId}` : null;
  const [watched, setWatched] = useState<{ key: string; items: T[] } | null>(null);

  useEffect(() => {
    if (!uid || !childId || !key) return;
    return watch(db, uid, childId, (items) => setWatched({ key, items }));
  }, [watch, uid, childId, key]);

  // Another child's items never flash while the new listener starts.
  return watched && watched.key === key ? watched.items : NONE;
}
