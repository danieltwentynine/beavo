import { Redirect, router } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useEffect, useState } from 'react';

import { GrownupsNavigation } from '@/components/ui/GrownupsNavigation';
import { useActiveChild } from '@/hooks/useActiveChild';
import { useLocalChildNames } from '@/hooks/useLocalChildNames';
import { t } from '@/lib/i18n';
import { tokens } from '@/lib/tokens';
import { ownerIdOf, useAuthStore } from '@/stores/authStore';
import { useChildStore } from '@/stores/childStore';

/**
 * The app shell. Order of the first-run gates: an owner (signed in, or using
 * this phone without an account) → current consent → profiles left on this
 * phone from device-only mode (offered to a signed-in parent, never moved
 * silently) → at least one child. Children never reach these gates alone: the
 * parent signs in once and the session persists.
 */
export default function TabsLayout() {
  const ownerId = useAuthStore(ownerIdOf);
  const signedIn = useAuthStore((s) => s.user !== null);
  const moveDeclined = useAuthStore((s) => s.moveDeclined);
  const localNames = useLocalChildNames();
  const consent = useAuthStore((s) => s.consent);
  const needsFirstChild = useChildStore((s) => s.loaded && s.children.length === 0 && !s.activeChildId);
  // Kid Mode shows only Brushing and Progress. Exiting is gated on Brushing.
  // Fails closed: until the active child is known, treat it as kid mode.
  const { child } = useActiveChild();
  const kidMode = child?.kidMode ?? true;
  const [unlockingChildId, setUnlockingChildId] = useState<string | null>(null);

  useEffect(() => {
    if (!unlockingChildId || !child || (child.id === unlockingChildId && kidMode)) return;
    // NativeTabs can remount when its routes change, so this handoff lives in its parent.
    const frame = requestAnimationFrame(() => {
      setUnlockingChildId(null);
      if (ownerId && child.id === unlockingChildId) router.navigate('/(tabs)/more');
    });
    return () => cancelAnimationFrame(frame);
  }, [child, kidMode, ownerId, unlockingChildId]);

  if (!ownerId) return <Redirect href="/onboarding/welcome" />;
  if (consent === 'unknown') return null;
  if (consent !== 'ok') return <Redirect href="/consent" />;
  if (signedIn && !moveDeclined && localNames && localNames.length > 0) return <Redirect href="/move-data" />;
  if (needsFirstChild) {
    // The device profiles arrive a moment after the first render: wait for them, or a
    // parent with profiles to move is sent to "add a child" and never offered the move.
    // ponytail: waits forever if device storage can't be read (retried on foreground); add a timeout if that shows up.
    if (signedIn && !moveDeclined && localNames === null) return null;
    return <Redirect href="/child-form" />;
  };

  return (
    <GrownupsNavigation.Provider value={{ unlockingChildId, setUnlockingChildId }}>
      <NativeTabs tintColor={tokens.brandPrimary}>
        <NativeTabs.Trigger name="brushing">
          <NativeTabs.Trigger.Label>{t('tabs.brushing')}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'mouth', selected: 'mouth.fill' }} md="brush" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="progress">
          <NativeTabs.Trigger.Label>{t('tabs.progress')}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} md="bar_chart" />
        </NativeTabs.Trigger>
        {!kidMode ? (
          <NativeTabs.Trigger name="overview">
            <NativeTabs.Trigger.Label>{t('tabs.overview')}</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="dentistry" />
          </NativeTabs.Trigger>
        ) : null}
        {!kidMode ? (
          <NativeTabs.Trigger name="more">
            <NativeTabs.Trigger.Label>{t('tabs.more')}</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} md="family_restroom" />
          </NativeTabs.Trigger>
        ) : null}
      </NativeTabs>
    </GrownupsNavigation.Provider>
  );
}
