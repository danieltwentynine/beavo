import { useEffect } from 'react';

import { db } from '@/lib/firebase';
import { loadSnapshot, saveSnapshot, useChildStore } from '@/stores/childStore';
import { watchChildren } from '@/src/data/children';
import { LOCAL_UID } from '@/src/data/local';
import { watchSlots } from '@/src/data/slots';

/**
 * Keeps stores/childStore in sync with Firestore for the signed-in parent:
 * starts from the on-device snapshot, then live listeners take over (they also
 * reflect offline writes at once). Without an account (`LOCAL_UID`) the data is
 * already on the device, so there is no snapshot to keep.
 * Mounted once, in app/_layout.tsx.
 */
export function useChildDataSync(uid: string | null): void {
  const activeChildId = useChildStore((s) => s.activeChildId);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    const snapshots = uid !== LOCAL_UID;
    if (snapshots) {
      void loadSnapshot(uid).then((snap) => {
        if (snap && !cancelled) useChildStore.getState().hydrate(snap);
      });
    }
    const stopChildren = watchChildren(db, uid, (children, fromCache) => {
      // A cold offline cache reports zero children; treating that as real would
      // send the parent to child setup and create a duplicate profile.
      if (children.length === 0 && fromCache) return;
      useChildStore.getState().setChildren(children);
    });
    const stopPersisting = useChildStore.subscribe((s) => {
      if (snapshots && s.loaded) void saveSnapshot(uid, s);
    });
    return () => {
      cancelled = true;
      stopChildren();
      stopPersisting();
      useChildStore.getState().reset();
    };
  }, [uid]);

  useEffect(() => {
    if (!uid || !activeChildId) return;
    return watchSlots(db, uid, activeChildId, (slots) => useChildStore.getState().setSlots(activeChildId, slots));
  }, [uid, activeChildId]);
}
