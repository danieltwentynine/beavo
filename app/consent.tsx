import { router } from 'expo-router';
import { Check } from 'phosphor-react-native';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { signOutParent } from '@/lib/account';
import { acceptConsent } from '@/lib/consent';
import { t } from '@/lib/i18n';
import { LEGAL_URLS } from '@/lib/legal';
import { outline, radius, tokens } from '@/lib/tokens';
import { useAuthStore } from '@/stores/authStore';

/**
 * Parent consent to the Terms and Privacy Policy (LGPD art. 14: specific
 * consent from a parent for children's data). The box starts unchecked and is
 * required. Shown again whenever LEGAL_VERSIONS changes.
 */
export default function ConsentScreen() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.consent);
  const setConsent = useAuthStore((s) => s.setConsent);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  const onAccept = async () => {
    if (!user || !checked) return;
    setSaving(true);
    await acceptConsent(user);
    setConsent('ok');
    router.replace('/');
  };

  const onSignOut = async () => {
    if (await signOutParent()) router.replace('/onboarding/welcome');
  };

  const link = (label: string, url: string) => (
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(url)} hitSlop={6} style={{ minHeight: 48, justifyContent: 'center' }}>
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

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          onPress={() => setChecked((c) => !c)}
          style={{ flexDirection: 'row', columnGap: 14, alignItems: 'flex-start', marginTop: 22 }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: radius.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: checked ? tokens.brandPrimary : tokens.surfaceCard,
              ...outline,
            }}
          >
            {checked ? <Check size={20} color={tokens.textOnBrand} weight="bold" /> : null}
          </View>
          <Text className="font-body" style={{ flex: 1, fontSize: 16, lineHeight: 23, color: tokens.textPrimary }}>
            {t('consent.checkbox')}
          </Text>
        </Pressable>

        <View style={{ marginTop: 'auto', paddingTop: 28, rowGap: 12 }}>
          <Button label={t('consent.continue')} size="lg" onPress={onAccept} disabled={!checked} loading={saving} />
          <Button label={t('consent.signOut')} variant="ghost" onPress={onSignOut} />
        </View>
      </ScrollView>
    </SafeScreen>
  );
}
