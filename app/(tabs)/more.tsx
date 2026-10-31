import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ParentalGate } from '@/components/ui/ParentalGate';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { TabHeader } from '@/components/ui/TabHeader';
import { deleteParentAccount, reauthMethod, shareDataExport, signOutParent, type DeleteAccountResult } from '@/lib/account';
import { t } from '@/lib/i18n';
import { LEGAL_URLS } from '@/lib/legal';
import { tokens } from '@/lib/tokens';

/** Parent-facing settings: children, account rights (export, delete), legal. */
export default function MoreTab() {
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null);
  // Export (children's health data) and delete both sit behind the grown-ups check.
  const [gateFor, setGateFor] = useState<'export' | 'delete' | null>(null);

  const confirmSignOut = () =>
    Alert.alert(t('more.signOutTitle'), t('more.signOutBody'), [
      { text: t('more.stay'), style: 'cancel' },
      {
        text: t('more.signOut'),
        style: 'destructive',
        onPress: async () => {
          if (await signOutParent()) router.replace('/onboarding/welcome');
          else Alert.alert(t('more.signOutFail'));
        },
      },
    ]);

  const onExport = async () => {
    setBusy('export');
    const ok = await shareDataExport();
    setBusy(null);
    if (!ok) Alert.alert(t('more.exportFail'));
  };

  const runDelete = async (password?: string) => {
    setBusy('delete');
    const result: DeleteAccountResult = await deleteParentAccount(password);
    setBusy(null);
    if (result === 'deleted') router.replace('/onboarding/welcome');
    else if (result === 'wrong-password') Alert.alert(t('more.wrongPassword'));
    else if (result === 'error') Alert.alert(t('more.deleteFail'));
  };

  const confirmDelete = () =>
    Alert.alert(t('more.deleteTitle'), t('more.deleteBody'), [
      { text: t('more.keepAccount'), style: 'cancel' },
      {
        text: t('more.deleteConfirm'),
        style: 'destructive',
        onPress: () => {
          if (reauthMethod() !== 'password') {
            void runDelete();
            return;
          }
          // ponytail: Alert.prompt is iOS-only; Android (Phase 4) needs a password field screen.
          Alert.prompt(
            t('more.passwordTitle'),
            t('more.passwordBody'),
            [
              { text: t('more.keepAccount'), style: 'cancel' },
              { text: t('more.confirm'), style: 'destructive', onPress: (pw?: string) => void runDelete(pw) },
            ],
            'secure-text',
          );
        },
      },
    ]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.surfacePage }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, rowGap: 24 }}>
        <TabHeader title={t('more.title')} showProfile={false} />

        <View style={{ rowGap: 12 }}>
          <SectionTitle>{t('more.children')}</SectionTitle>
          <Button label={t('more.manageChildren')} variant="outline" onPress={() => router.push('/child-picker')} />
        </View>

        <View style={{ rowGap: 12 }}>
          <SectionTitle>{t('more.account')}</SectionTitle>
          <Button label={t('more.export')} variant="outline" loading={busy === 'export'} onPress={() => setGateFor('export')} />
          <Button label={t('more.signOut')} variant="outline" onPress={confirmSignOut} />
          <Button label={t('more.delete')} variant="ghost" loading={busy === 'delete'} onPress={() => setGateFor('delete')} />
        </View>

        <View style={{ rowGap: 12 }}>
          <SectionTitle>{t('more.legal')}</SectionTitle>
          <Button label={t('consent.terms')} variant="ghost" onPress={() => void Linking.openURL(LEGAL_URLS.terms)} />
          <Button label={t('consent.privacy')} variant="ghost" onPress={() => void Linking.openURL(LEGAL_URLS.privacy)} />
        </View>

        <Text className="font-body" style={{ fontSize: 14, color: tokens.textTertiary, textAlign: 'center' }}>
          {t('more.version', { version: Constants.expoConfig?.version ?? '' })}
        </Text>
      </ScrollView>

      <ParentalGate
        visible={gateFor !== null}
        onPass={() => {
          const action = gateFor;
          setGateFor(null);
          if (action === 'export') void onExport();
          else confirmDelete();
        }}
        onCancel={() => setGateFor(null)}
      />
    </SafeAreaView>
  );
}
