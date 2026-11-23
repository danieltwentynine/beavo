import { router } from 'expo-router';
import { Check } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { signOutParent } from '@/lib/account';
import { leaveLocalMode } from '@/lib/localData';
import { acceptConsent, checkConsent } from '@/lib/consent';
import { t } from '@/lib/i18n';
import { LEGAL_URLS } from '@/lib/legal';
import { cardShadow, controlBorder, radius, tokens } from '@/lib/tokens';
import { ownerIdOf, useAuthStore } from '@/stores/authStore';
import { useNoticeStore } from '@/stores/noticeStore';

/**
 * Parent consent (LGPD art. 14: specific consent from a parent for children's
 * data). Two separate items, each in its own highlighted card, both starting
 * unchecked and both required: the Terms + Privacy Policy, and the children's
 * dental (health) records. Shown again whenever LEGAL_VERSIONS changes.
 * The rules take the versions and the time from the server side (firestore.rules
 * validNewConsent). How the parent is verified is still open (lawyer review,
 * docs/decisions/0006-fix-sprint-v1-decisions.md).
 */
type ConsentItem = 'terms' | 'health';

function ConsentCheck({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onToggle}
      style={{
        flexDirection: 'row',
        columnGap: 14,
        alignItems: 'flex-start',
        padding: 16,
        borderRadius: radius.lg,
        backgroundColor: checked ? tokens.primarySoft : tokens.surfaceCard,
        ...cardShadow,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: radius.sm,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: checked ? tokens.brandPrimary : tokens.surfaceCard,
          ...controlBorder,
        }}
      >
        {checked ? <Check size={20} color={tokens.textOnBrand} weight="bold" /> : null}
      </View>
      <Text className="font-body" style={{ flex: 1, fontSize: 16, lineHeight: 23, color: tokens.textPrimary }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function ConsentScreen() {
  const user = useAuthStore((s) => s.user);
  const ownerId = useAuthStore(ownerIdOf);
  const status = useAuthStore((s) => s.consent);
  const setConsent = useAuthStore((s) => s.setConsent);
  const [checked, setChecked] = useState<Record<ConsentItem, boolean>>({ terms: false, health: false });
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const allChecked = checked.terms && checked.health;
  const lateRefusal = useNoticeStore((s) => s.notice?.key === 'consent.saveFailed');
  const toggle = (item: ConsentItem) => setChecked((c) => ({ ...c, [item]: !c[item] }));
  // Owner rule: the grown-ups check is only for app settings and child management.
  // Sign-up stays simple: the legal links open directly and accepting needs only the two items.

  // Only a server-confirmed consent opens the app; 'pending' stays here (lib/consent.ts).
  useEffect(() => {
    if (status === 'ok') router.replace('/');
  }, [status]);

  const accept = async () => {
    if (!ownerId || !allChecked) return;
    setSaving(true);
    setFailed(false);
    let result: Awaited<ReturnType<typeof acceptConsent>>;
    try {
      result = await acceptConsent({ uid: ownerId });
    } catch {
      result = 'needed';
    }
    setSaving(false);
    if (result === 'needed' || result === 'updated') setFailed(true);
    setConsent(result);
  };
  // No grown-ups check here (owner rule). How the parent is verified is still open (lawyer, ADR 0007).
  const onAccept = () => void accept();

  const retry = async () => {
    if (!ownerId) return;
    setSaving(true);
    const result = await checkConsent(ownerId);
    setSaving(false);
    setConsent(result);
  };

  const onSignOut = async () => {
    // Without an account there is nothing to sign out of: just step back out.
    if (!user) await leaveLocalMode();
    else if (!(await signOutParent())) return;
    router.replace('/onboarding/welcome');
  };

  const link = (label: string, url: string) => (
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(url).catch(() => undefined)} hitSlop={6} style={{ minHeight: 48, justifyContent: 'center' }}>
      <Text className="font-display-semi" style={{ fontSize: 17, color: tokens.textLink, textDecorationLine: 'underline' }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <SafeScreen>
      <ScrollView contentContainerClassName="flex-grow px-6 pb-7 pt-4">
        <Text className="font-display text-3xl text-ink">{t('consent.title')}</Text>
        {status === 'updated' ? (
          <Text className="mt-3 font-body-semi text-base text-ink">{t('consent.updated')}</Text>
        ) : null}
        <Text className="mt-3 font-body text-base text-muted">{t('consent.body')}</Text>

        <View style={{ marginTop: 16 }}>
          {link(t('consent.terms'), LEGAL_URLS.terms)}
          {link(t('consent.privacy'), LEGAL_URLS.privacy)}
        </View>

        {status === 'pending' ? (
          <View style={{ marginTop: 22, padding: 16, borderRadius: radius.lg, backgroundColor: tokens.surfaceCard, ...cardShadow }}>
            <Text accessibilityLiveRegion="polite" className="font-body-semi" style={{ fontSize: 16, lineHeight: 23, color: tokens.textPrimary }}>
              {t('consent.pendingOnline')}
            </Text>
          </View>
        ) : (
          <>
            <View style={{ marginTop: 22, rowGap: 12 }}>
              <ConsentCheck label={t('consent.checkTerms')} checked={checked.terms} onToggle={() => toggle('terms')} />
              <ConsentCheck label={t('consent.checkHealth')} checked={checked.health} onToggle={() => toggle('health')} />
            </View>
            {!allChecked ? <Text className="mt-3 font-body text-sm text-muted">{t('consent.required')}</Text> : null}
          </>
        )}
        {/* A late refusal (after 'pending') arrives as a notice; shown here too, since the banner needs loaded child data. */}
        {failed || lateRefusal ? <Text className="mt-3 font-body-semi text-base text-ink">{t('consent.saveFailed')}</Text> : null}

        <View style={{ marginTop: 'auto', paddingTop: 28, rowGap: 12 }}>
          {status === 'pending' ? (
            <Button label={t('consent.retry')} size="lg" onPress={() => void retry()} loading={saving} />
          ) : (
            <Button label={t('consent.continue')} size="lg" onPress={onAccept} disabled={!allChecked} loading={saving} />
          )}
          <Button label={user ? t('consent.signOut') : t('childForm.back')} variant="ghost" onPress={onSignOut} />
        </View>
      </ScrollView>
    </SafeScreen>
  );
}
