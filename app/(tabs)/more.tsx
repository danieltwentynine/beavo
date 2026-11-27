import Constants from 'expo-constants';
import { router } from 'expo-router';
import {
  Bell,
  CaretRight,
  DownloadSimple,
  FileText,
  Gear,
  LockSimple,
  PencilSimple,
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
import { Alert, Linking, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BeavoMark } from '@/components/brand/BeavoBrand';
import { grantReminderSettingsAccess } from '@/components/reminders/reminderAudience';
import { Avatar } from '@/components/kids/Avatar';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { useParentalGate } from '@/components/ui/ParentalGate';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { TabHeader } from '@/components/ui/TabHeader';
import { TabScenery } from '@/components/ui/TabScenery';
import { useActiveChild } from '@/hooks/useActiveChild';
import {
  deleteParentAccount,
  pickBackup,
  reauthMethod,
  restoreBackup,
  shareDataExport,
  signOutParent,
  type DeleteAccountResult,
} from '@/lib/account';
import { db } from '@/lib/firebase';
import { t } from '@/lib/i18n';
import { eraseLocalData } from '@/lib/localData';
import { LEGAL_URLS, REVIEW_URL } from '@/lib/legal';
import { colors } from '@/lib/tokens';
import { updateChild } from '@/src/data/children';
import { background } from '@/src/data/firestore';
import { ownerIdOf, useAuthStore } from '@/stores/authStore';

async function openExternal(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(t('more.openFail'));
  }
}

function Section({ title, children, peek = false }: { title: string; children: ReactNode; peek?: boolean }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', columnGap: 8 }}>
        <View style={{ flex: 1 }}><SectionTitle>{title}</SectionTitle></View>
        {peek ? (
          <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ marginRight: 18 }}>
            <BeavoMark width={48} accessible={false} />
          </View>
        ) : null}
      </View>
      <Card padding={0}>{children}</Card>
    </View>
  );
}

/**
 * Parent area (hidden in kid mode). Owner rule: the grown-ups check guards only
 * app settings and child management — settings, routine, categories, backup,
 * account deletion and erasing data. Legal and review links, sign-in and
 * sign-out open directly.
 */
export default function MoreTab() {
  const [busy, setBusy] = useState<'export' | 'import' | 'delete' | null>(null);
  // No account: the data is only on this phone (ADR 0005), so the account rows don't apply.
  const signedIn = useAuthStore((s) => s.user !== null);
  const uid = useAuthStore(ownerIdOf);
  const { child } = useActiveChild();
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
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <TabScenery />
      <ScrollView contentContainerStyle={{ width: '100%', maxWidth: 560, alignSelf: 'center', padding: 20, paddingTop: 4, rowGap: 24 }}>
        <TabHeader title={t('more.title')} />

        {child && uid ? (
          <Section title={t('grownups.childSection', { name: child.name })} peek>
            <ListRow
              Icon={LockSimple} tile="primary"
              label={t('today.kidMode')}
              hint={t('today.kidModeHint')}
              right={
                <Switch
                  accessibilityLabel={t('today.kidMode')}
                  accessibilityHint={t('today.kidModeHint')}
                  style={{ minHeight: 48 }}
                  value={child.kidMode}
                  trackColor={{ true: colors.primary, false: colors.zoneLine }}
                  onValueChange={(next) => {
                    if (!next) return;
                    background(updateChild(db, uid, child.id, { kidMode: true }));
                    router.navigate('/(tabs)/brushing');
                  }}
                />
              }
            />
            <ListRow Icon={Bell} tile="routine" label={t('reminders.title')}
              onPress={() => requireParent(() => {
                if (grantReminderSettingsAccess(uid, child.id)) router.push('/reminders');
              })} />
            <ListRow Icon={PencilSimple} tile="routine" label={t('today.editRoutine')} onPress={() => requireParent(() => router.push('/slots'))} last />
          </Section>
        ) : null}

        <Section title={t('more.children')}>
          <ListRow Icon={UsersThree} tile="profiles" label={t('more.profiles')} onPress={() => router.push('/child-picker')} last
            right={(
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
                style={{ flexDirection: 'row', alignItems: 'center', columnGap: 10 }}>
                {child ? <Avatar avatarId={child.avatarIcon} color={child.avatarColor} size={32} /> : null}
                <CaretRight size={20} color={colors.inkMuted} weight="bold" />
              </View>
            )} />
        </Section>

        <Section title={t('more.data')}>
          <ListRow Icon={Tag} tile="categories" label={t('more.categories')} onPress={() => requireParent(() => router.push('/categories'))} />
          <ListRow
            Icon={UploadSimple} tile="export"
            label={t('more.exportBackup')}
            hint={busy === 'export' ? '…' : undefined}
            onPress={() => requireParent(() => void onExport())}
          />
          <ListRow
            Icon={DownloadSimple} tile="import"
            label={t('more.importBackup')}
            hint={busy === 'import' ? '…' : undefined}
            onPress={() => requireParent(() => void onImport())}
            last
          />
        </Section>

        <Section title={t('more.app')}>
          <ListRow Icon={Gear} label={t('more.settings')} onPress={() => requireParent(() => router.push('/settings'))} last={!reviewUrl} />
          {reviewUrl ? (
            <ListRow Icon={Star} label={t('more.review')} external onPress={() => void openExternal(reviewUrl)} last />
          ) : null}
        </Section>

        <Section title={t('more.legal')}>
          <ListRow Icon={FileText} label={t('more.termsAndConditions')} external onPress={() => void openExternal(LEGAL_URLS.terms)} />
          <ListRow Icon={ShieldCheck} label={t('consent.privacy')} external onPress={() => void openExternal(LEGAL_URLS.privacy)} last />
        </Section>

        {signedIn ? (
          <Section title={t('more.account')}>
            <ListRow Icon={SignOut} label={t('more.signOut')} onPress={confirmSignOut} />
            <ListRow
              Icon={Trash} tile="danger"
              label={t('more.delete')}
              hint={busy === 'delete' ? '…' : undefined}
              onPress={() => requireParent(confirmDelete)}
              last
            />
          </Section>
        ) : (
          <View style={{ rowGap: 10 }}>
            <Section title={t('more.device')}>
              <ListRow Icon={UserPlus} label={t('more.createAccount')} onPress={() => router.push('/(auth)/register')} />
              <ListRow Icon={SignOut} label={t('more.haveAccount')} onPress={() => router.push('/(auth)/login')} />
              <ListRow
                Icon={Trash} tile="danger"
                label={t('more.erase')}
                hint={busy === 'delete' ? '…' : undefined}
                onPress={() => requireParent(confirmErase)}
                last
              />
            </Section>
            <Text className="font-body" style={{ fontSize: 16, lineHeight: 22, color: colors.inkMuted }}>
              {t('more.deviceHint')}
            </Text>
          </View>
        )}

        <Text className="font-body" style={{ fontSize: 16, color: colors.inkMuted, textAlign: 'center' }}>
          {t('more.version', { version: Constants.expoConfig?.version ?? '' })}
        </Text>
      </ScrollView>
      {gate}
    </SafeAreaView>
  );
}
