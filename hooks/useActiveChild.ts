import { router } from 'expo-router';
import { useEffect } from 'react';
import { Alert } from 'react-native';

import { fetchActiveChild, moveLocalDataToAccount } from '@/lib/children';
import { LOCAL_UID } from '@/lib/localData';
import { ownerIdOf, useAuthStore } from '@/stores/authStore';
import { useChildStore } from '@/stores/childStore';

/** The parent decides whether the child stored on this phone goes into the account they just signed in to. */
function confirmMove(childName: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      `Move ${childName}'s progress into this account?`,
      `This phone has a profile for ${childName} that isn't in any account. Moving it saves it to this account and removes it from the phone.`,
      [
        { text: 'Keep it on this phone', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Move it to this account', onPress: () => resolve(true) },
      ],
      { cancelable: false },
    );
  });
}

/**
 * Resolves the active child: prefers the in-memory store (just created during
 * onboarding), otherwise fetches the first child from Firestore — or from the
 * device when the parent uses Zing without an account. A parent who has just
 * signed in to an account with no child is asked whether to move their device data into it.
 * If there is no child anywhere, sends them to child setup.
 */
export function useActiveChild() {
  const ownerId = useAuthStore(ownerIdOf);
  const setLocal = useAuthStore((s) => s.setLocal);
  const activeChild = useChildStore((s) => s.activeChild);
  const setActiveChild = useChildStore((s) => s.setActiveChild);

  // A child left in memory by the previous owner (signed out, or just moved from
  // device-only mode to an account) is not this owner's child.
  const child = activeChild?.parentUid === ownerId ? activeChild : null;

  useEffect(() => {
    let cancelled = false;
    if (child || !ownerId) return;
    (async () => {
      try {
        let found = await fetchActiveChild(ownerId);
        if (!found && ownerId !== LOCAL_UID) {
          found = await moveLocalDataToAccount(ownerId, confirmMove);
          if (found) setLocal(false);
        }
        if (cancelled) return;
        if (found) {
          setActiveChild(found);
        } else {
          router.replace('/onboarding/child-setup');
        }
      } catch {
        // Couldn't load (offline, rules, …) — stay put instead of sending the
        // parent to child setup, which would create a duplicate profile.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ownerId, child, setActiveChild, setLocal]);

  return { child };
}
