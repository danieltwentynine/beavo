import { useState } from 'react';

import { useActiveChild } from '@/hooks/useActiveChild';
import { useRetryingWatch } from '@/hooks/useRetryingWatch';
import { db } from '@/lib/firebase';
import { ownerIdOf, useAuthStore } from '@/stores/authStore';
import type { WatchErrorHandler } from '@/src/data/firestore';

type Watch<T> = (
  database: typeof db,
  uid: string,
  childId: string,
  onChange: (items: T[], confirmed?: boolean) => void,
  onError?: WatchErrorHandler,
) => () => void;

const NONE: never[] = [];

/**
 * Live items of the active child from one of the `watch*` repository listeners.
 * A failed listener is retried; meanwhile the last items stay on screen and the
 * data is marked stale (stores/noticeStore.ts, source 'childData').
 */
export function useChildWatchSnapshot<T>(watch: Watch<T>) {
  const uid = useAuthStore(ownerIdOf);
  const { child } = useActiveChild();
  const childId = child?.id ?? null;
  const key = uid && childId ? `${uid}/${childId}` : null;
  const [watched, setWatched] = useState<{ key: string; items: T[]; confirmedCount: number | null } | null>(null);

  useRetryingWatch('childData', key, (onError, onLive) =>
    watch(
      db,
      uid as string,
      childId as string,
      (items, confirmed = true) => {
        onLive();
        setWatched((previous) => ({
          key: key as string,
          items,
          confirmedCount: confirmed ? items.length : previous?.key === key ? previous.confirmedCount : null,
        }));
      },
      onError,
    ),
  );

  // Another child's items never flash while the new listener starts.
  return watched?.key === key ? watched : null;
}

export function useChildWatch<T>(watch: Watch<T>): T[] {
  return useChildWatchSnapshot(watch)?.items ?? NONE;
}
