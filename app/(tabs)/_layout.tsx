import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { t } from '@/lib/i18n';
import { tokens } from '@/lib/tokens';
import { useAuthStore } from '@/stores/authStore';
import { useChildStore } from '@/stores/childStore';

/**
 * The signed-in shell. Order of the first-run gates: signed in → current
 * consent → at least one child. Children never reach these gates alone: the
 * parent signs in once and the session persists.
 */
export default function TabsLayout() {
  const user = useAuthStore((s) => s.user);
  const consent = useAuthStore((s) => s.consent);
  const needsFirstChild = useChildStore((s) => s.loaded && s.children.length === 0 && !s.activeChildId);

  if (!user) return <Redirect href="/onboarding/welcome" />;
  if (consent === 'unknown') return null;
  if (consent !== 'ok') return <Redirect href="/consent" />;
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
      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Label>{t('tabs.more')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'ellipsis.circle', selected: 'ellipsis.circle.fill' }} md="more_horiz" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
