import { useRef, useState } from 'react';

import { useRetryingWatch } from '@/hooks/useRetryingWatch';
import { seedCategories } from '@/lib/consent';
import { db } from '@/lib/firebase';
import { ownerIdOf, useAuthStore } from '@/stores/authStore';
import { watchCategories } from '@/src/data/toothEvents';
import type { Category } from '@/types';

/**
 * The parent's symptom/treatment categories. Accounts that consented offline
 * never got the defaults; if the SERVER (or, without an account, this device)
 * says there are none, seed them now. A failed listener is retried.
 */
export function useCategories(): Category[] {
  const uid = useAuthStore(ownerIdOf);
  const [categories, setCategories] = useState<Category[]>([]);
  const seededFor = useRef<string | null>(null);

  useRetryingWatch('categories', uid, (onError, onLive) =>
    watchCategories(
      db,
      uid as string,
      (list, fromCache) => {
        onLive();
        setCategories(list);
        if (list.length === 0 && !fromCache && seededFor.current !== uid) {
          seededFor.current = uid;
          seedCategories(uid as string);
        }
      },
      onError,
    ),
  );

  return categories;
}
