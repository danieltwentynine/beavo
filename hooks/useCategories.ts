import { useEffect, useState } from 'react';

import { seedCategories } from '@/lib/consent';
import { db } from '@/lib/firebase';
import { ownerIdOf, useAuthStore } from '@/stores/authStore';
import { watchCategories } from '@/src/data/toothEvents';
import type { Category } from '@/types';

/**
 * The parent's symptom/treatment categories. Accounts that consented offline
 * never got the defaults; if the SERVER (or, without an account, this device)
 * says there are none, seed them now.
 */
export function useCategories(): Category[] {
  const uid = useAuthStore(ownerIdOf);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (!uid) return;
    let seeded = false;
    return watchCategories(db, uid, (list, fromCache) => {
      setCategories(list);
      if (list.length === 0 && !fromCache && !seeded) {
        seeded = true;
        seedCategories(uid);
      }
    });
  }, [uid]);

  return categories;
}
