import Constants from 'expo-constants';
import { router } from 'expo-router';
import {
  DownloadSimple,
  FileText,
  Gear,
  ShieldCheck,
  SignOut,
  Star,
  Tag,
  Trash,
  UploadSimple,
  UserPlus,
  UsersThree,
} from 'phosphor-react-native';
import { useState, type ReactNode } from 'react';
import { Alert, Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { useParentalGate } from '@/components/ui/ParentalGate';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { TabHeader } from '@/components/ui/TabHeader';
import {
  deleteParentAccount,
  pickBackup,
  reauthMethod,
  restoreBackup,
  shareDataExport,
  signOutParent,
  type DeleteAccountResult,
} from '@/lib/account';
import { t } from '@/lib/i18n';
import { eraseLocalData } from '@/lib/localData';
import { LEGAL_URLS, REVIEW_URL } from '@/lib/legal';
import { tokens } from '@/lib/tokens';
import { useAuthStore } from '@/stores/authStore';

async function openExternal(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(t('more.openFail'));
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View>
      <SectionTitle>{title}</SectionTitle>
      <Card padding={0}>{children}</Card>
    </View>
  );
}

/**
 * Parent area (hidden in kid mode). Apple Kids Category: every external link,
 * purchase, backup and destructive action goes through the parental gate.
 */
export default function MoreTab() {
  const [busy, setBusy] = useState<'export' | 'import' | 'delete' | null>(null);
  // No account: the data is only on this phone (ADR 0005), so the account rows don't apply.
  const signedIn = useAuthStore((s) => s.user !== null);
  const { gate, requireParent } = useParentalGate();

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

  const onImport = async () => {
    setBusy('import');
    const picked = await pickBackup();
    setBusy(null);
    if (picked.status === 'cancelled') return;
    if (picked.status === 'invalid') {
      Alert.alert(t('more.importInvalid'));
      return;
    }
    const { backup } = picked;
    const records = backup.children.reduce((n, c) => n + c.brushingSlots.length + c.brushingSessions.length + c.toothEvents.length, 0);
    Alert.alert(t('more.importTitle'), t('more.importBody', { children: backup.children.length, records }), [
      { text: t('more.importCancel'), style: 'cancel' },
      {
        text: t('more.importConfirm'),
        onPress: async () => {
          setBusy('import');
          const count = await restoreBackup(backup);
          setBusy(null);
          Alert.alert(count === null ? t('more.importFail') : t('more.importDone', { count }));
        },
      },
    ]);
  };

  const confirmErase = () =>
    Alert.alert(t('more.eraseTitle'), t('more.eraseBody'), [
      { text: t('more.eraseKeep'), style: 'cancel' },
      {
        text: t('more.eraseConfirm'),
        style: 'destructive',
        onPress: async () => {
          setBusy('delete');
          const ok = await eraseLocalData();
          setBusy(null);
          if (ok) router.replace('/onboarding/welcome');
          else Alert.alert(t('more.eraseFail'));
        },
      },
    ]);

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

  const reviewUrl = REVIEW_URL;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.surfacePage }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, rowGap: 24 }}>
        <TabHeader title={t('more.title')} showProfile={false} />

        <Section title={t('more.children')}>
          <ListRow Icon={UsersThree} label={t('more.profiles')} onPress={() => router.push('/child-picker')} last />
        </Section>

        <Section title={t('more.data')}>
          <ListRow Icon={Tag} label={t('more.categories')} onPress={() => requireParent(() => router.push('/categories'))} />
          <ListRow
            Icon={UploadSimple}
            label={t('more.exportBackup')}
            hint={busy === 'export' ? '…' : undefined}
            onPress={() => requireParent(() => void onExport())}
          />
          <ListRow
            Icon={DownloadSimple}
            label={t('more.importBackup')}
            hint={busy === 'import' ? '…' : undefined}
            onPress={() => requireParent(() => void onImport())}
            last
          />
        </Section>

        <Section title={t('more.app')}>
          <ListRow Icon={Gear} label={t('more.settings')} onPress={() => requireParent(() => router.push('/settings'))} last={!reviewUrl} />
          {reviewUrl ? (
            <ListRow Icon={Star} label={t('more.review')} external onPress={() => requireParent(() => void openExternal(reviewUrl))} last />
          ) : null}
        </Section>

        <Section title={t('more.legal')}>
          <ListRow Icon={FileText} label={t('more.termsAndConditions')} external onPress={() => requireParent(() => void openExternal(LEGAL_URLS.terms))} />
          <ListRow Icon={ShieldCheck} label={t('consent.privacy')} external onPress={() => requireParent(() => void openExternal(LEGAL_URLS.privacy))} last />
        </Section>

        {signedIn ? (
          <Section title={t('more.account')}>
            <ListRow Icon={SignOut} label={t('more.signOut')} onPress={() => requireParent(confirmSignOut)} />
            <ListRow
              Icon={Trash}
              label={t('more.delete')}
              hint={busy === 'delete' ? '…' : undefined}
              onPress={() => requireParent(confirmDelete)}
              last
            />
          </Section>
        ) : (
          <View style={{ rowGap: 10 }}>
            <Section title={t('more.device')}>
              <ListRow Icon={UserPlus} label={t('more.createAccount')} onPress={() => requireParent(() => router.push('/(auth)/register'))} />
              <ListRow Icon={SignOut} label={t('more.haveAccount')} onPress={() => requireParent(() => router.push('/(auth)/login'))} />
              <ListRow
                Icon={Trash}
                label={t('more.erase')}
                hint={busy === 'delete' ? '…' : undefined}
                onPress={() => requireParent(confirmErase)}
                last
              />
            </Section>
            <Text className="font-body" style={{ fontSize: 14, lineHeight: 20, color: tokens.textSecondary }}>
              {t('more.deviceHint')}
            </Text>
          </View>
        )}

        <Text className="font-body" style={{ fontSize: 14, color: tokens.textSecondary, textAlign: 'center' }}>
          {t('more.version', { version: Constants.expoConfig?.version ?? '' })}
        </Text>
      </ScrollView>
      {gate}
    </SafeAreaView>
  );
}
