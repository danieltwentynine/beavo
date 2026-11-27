import { router, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useActiveChild } from '@/hooks/useActiveChild';
import { shouldOfferReminders } from '@/src/data/reminders';
import { currentSlots } from '@/src/data/schedule';
import { ownerIdOf, useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';

import { canManageReminders } from './reminderAudience';

export function ReminderOfferLauncher({ ready }: { ready: boolean }) {
  const segments: readonly string[] = useSegments();
  const [group, tab] = segments;
  const owner = useAuthStore(ownerIdOf);
  const consent = useAuthStore((state) => state.consent);
  const settings = useSettingsStore((state) => state.reminders);
  const loaded = useSettingsStore((state) => state.loaded);
  const { child, slots } = useActiveChild();
  const hasSlots = currentSlots(slots).length > 0;
  const offered = useRef(new Set<string>());
  const deferredToGrownups = useRef(new Set<string>());

  useEffect(() => {
    if (!ready || !loaded || !owner || consent !== 'ok' || !child || settings.ownerId !== owner || offered.current.has(owner)) return;
    if (child.kidMode) {
      deferredToGrownups.current.add(owner);
      return;
    }
    if (group !== '(tabs)' || (deferredToGrownups.current.has(owner) && tab !== 'more')) return;
    if (!shouldOfferReminders({ offer: settings.offer, enabled: settings.enabled, ownerId: owner, hasChild: hasSlots, kidMode: child.kidMode })) return;
    if (!canManageReminders(owner, child.id)) return;

    offered.current.add(owner);
    router.push('/reminder-offer');
  }, [ready, loaded, owner, consent, child, settings, group, tab, hasSlots]);

  return null;
}
