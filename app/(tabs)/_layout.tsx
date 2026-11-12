import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

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
  // Kid mode hides the parent area (More). Turning it off is gated on the Brushing tab.
  // Fails closed: until the active child is known, treat it as kid mode.
  const kidMode = useActiveChild().child?.kidMode ?? true;

  if (!ownerId) return <Redirect href="/onboarding/welcome" />;
  if (consent === 'unknown') return null;
  if (consent !== 'ok') return <Redirect href="/consent" />;
  if (signedIn && !moveDeclined && localNames && localNames.length > 0) return <Redirect href="/move-data" />;
  if (needsFirstChild) return <Redirect href="/child-form" />;

  return (
    <NativeTabs tintColor={tokens.brandPrimary}>
      <NativeTabs.Trigger name="overview">
        <NativeTabs.Trigger.Label>{t('tabs.overview')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="brushing">
        <NativeTabs.Trigger.Label>{t('tabs.brushing')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'mouth', selected: 'mouth.fill' }} md="brush" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="progress">
        <NativeTabs.Trigger.Label>{t('tabs.progress')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} md="bar_chart" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more" hidden={kidMode}>
        <NativeTabs.Trigger.Label>{t('tabs.more')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'ellipsis.circle', selected: 'ellipsis.circle.fill' }} md="more_horiz" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
