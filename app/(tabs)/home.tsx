import { router, useFocusEffect } from 'expo-router';
import { signOut } from 'firebase/auth';
import { CheckCircle, Gear, Moon, Play, Sun } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/kids/Avatar';
import { StreakDisplay } from '@/components/kids/StreakDisplay';
import { Card } from '@/components/ui/Card';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { useActiveChild } from '@/hooks/useActiveChild';
import { sameDay } from '@/lib/streak';
import { fetchRecentSessions, type RecentSession } from '@/lib/sessions';
import { outline, palette, radius, tokens } from '@/lib/tokens';
import { auth } from '@/lib/firebase';
import { locale, t } from '@/lib/i18n';
import { clearLocalData } from '@/lib/localStore';
import { signOutGoogle } from '@/lib/socialAuth';
import { useAuthStore } from '@/stores/authStore';
import { useChildStore } from '@/stores/childStore';
import { useSessionStore } from '@/stores/sessionStore';

function formatTime(date: Date): string {
  return date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

function greetingForHour(hour: number): string {
  if (hour < 12) return t('home.greeting.morning');
  if (hour < 18) return t('home.greeting.afternoon');
  return t('home.greeting.evening');
}

function confirmLogOut(): void {
  Alert.alert(t('home.logout.title'), t('home.logout.body'), [
    { text: t('home.logout.stay'), style: 'cancel' },
    {
      text: t('home.logout.confirm'),
      style: 'destructive',
      onPress: async () => {
        try {
          await signOut(auth);
          await signOutGoogle();
        } catch {
          Alert.alert(t('home.logout.failTitle'), t('home.logout.failBody'));
          return;
        }
        // No auth guard on (tabs) — nothing navigates on sign-out by itself.
        useChildStore.getState().setActiveChild(null);
        router.replace('/onboarding/welcome');
      },
    },
  ]);
}

/** Without an account the settings button offers a backup instead of log out. */
function offerAccount(): void {
  Alert.alert(t('home.backup.title'), t('home.backup.body'), [
    { text: t('home.backup.create'), onPress: () => router.push('/(auth)/register') },
    { text: t('home.backup.have'), onPress: () => router.push('/(auth)/login') },
    { text: t('home.backup.erase'), style: 'destructive', onPress: confirmErase },
    { text: t('home.backup.notNow'), style: 'cancel' },
  ]);
}

function confirmErase(): void {
  Alert.alert(t('home.erase.title'), t('home.erase.body'), [
    { text: t('home.erase.keep'), style: 'cancel' },
    {
      text: t('home.erase.confirm'),
      style: 'destructive',
      onPress: async () => {
        try {
          await clearLocalData();
        } catch {
          Alert.alert(t('home.erase.failTitle'), t('home.erase.failBody'));
          return;
        }
        useAuthStore.getState().setLocal(false);
        useChildStore.getState().setActiveChild(null);
        useSessionStore.getState().setLastResult(null);
        router.replace('/onboarding/welcome');
      },
    },
  ]);
}

interface Slot {
  label: string;
  done: boolean;
  time: string;
  Icon: typeof Sun;
}

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const { child } = useActiveChild();
  const usingAccount = Boolean(user);
  const [todaySessions, setTodaySessions] = useState<RecentSession[]>([]);

  // Re-fetch on focus so a just-finished session shows up when the
  // child comes back to this tab (tab screens stay mounted).
  useFocusEffect(
    useCallback(() => {
      if (!child) return;
      let cancelled = false;
      fetchRecentSessions(child.parentUid, child.id, 10).then((sessions) => {
        if (!cancelled) setTodaySessions(sessions.filter((s) => sameDay(s.completedAt, new Date())));
      });
      return () => {
        cancelled = true;
      };
    }, [child]),
  );

  const parentName = user?.displayName?.split(' ')[0] ?? t('home.parentFallback');
  const hour = new Date().getHours();
  const morning = todaySessions.find((s) => s.completedAt.getHours() < 12);
  const evening = todaySessions.find((s) => s.completedAt.getHours() >= 12);
  const nextSlot = !morning && hour < 12 ? 'morning' : 'evening';
  const slots: Slot[] = [
    {
      label: t('common.morning'),
      done: Boolean(morning),
      time: morning ? formatTime(morning.completedAt) : t('home.notYet'),
      Icon: Sun,
    },
    {
      label: t('common.evening'),
      done: Boolean(evening),
      time: evening ? formatTime(evening.completedAt) : t('home.notYet'),
      Icon: Moon,
    },
  ];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.surfacePage }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, rowGap: 22 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text className="font-body-semi" style={{ fontSize: 14, color: tokens.textSecondary }}>
              {greetingForHour(hour)}
            </Text>
            <Text className="font-display" style={{ fontSize: 26, color: tokens.textPrimary }}>
              {parentName}
            </Text>
          </View>
          <Card
            onPress={usingAccount ? confirmLogOut : offerAccount}
            accessibilityLabel={t('home.settings')}
            padding={0}
            radius={radius.pill}
            style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Gear size={24} color={tokens.textPrimary} weight="bold" />
          </Card>
        </View>

        {/* Active child card */}
        <Card tone="soft" padding={18} radius={radius['2xl']}>
          <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 14 }}>
            <Avatar avatarId={child?.avatarId ?? 'shark'} size={62} />
            <View style={{ flex: 1 }}>
              <Text className="font-display" style={{ fontSize: 20, color: tokens.textPrimary }}>
                {child?.name ?? t('home.childFallback')}
              </Text>
              <Text className="font-body-semi" style={{ fontSize: 13, color: tokens.textSecondary }}>
                {t('home.age', { age: child?.age ?? '–' })}
              </Text>
            </View>
            <StreakDisplay days={child?.streakCurrent ?? 0} layout="chip" />
          </View>
        </Card>

        {/* Today's brushing */}
        <View>
          <SectionTitle>{t('home.today')}</SectionTitle>
          <View style={{ flexDirection: 'row', columnGap: 12 }}>
            {slots.map((s) => (
              <Card key={s.label} padding={16} style={{ flex: 1, alignItems: 'center' }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    marginBottom: 8,
                    borderRadius: radius.pill,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: s.done ? tokens.surfaceMint : tokens.surfaceSunken,
                    ...outline,
                  }}
                >
                  {s.done ? (
                    <CheckCircle size={24} color={tokens.brandPrimary} weight="fill" />
                  ) : (
                    <s.Icon size={24} color={tokens.textTertiary} weight="fill" />
                  )}
                </View>
                <Text className="font-display-semi" style={{ fontSize: 17, color: tokens.textPrimary }}>
                  {s.label}
                </Text>
                <Text
                  className="font-body-semi"
                  style={{ fontSize: 13, color: s.done ? tokens.textLink : tokens.textTertiary }}
                >
                  {s.done ? t('home.done', { time: s.time }) : s.time}
                </Text>
              </Card>
            ))}
          </View>
        </View>

        {/* CTA */}
        <Card tone="cobalt" padding={20} radius={radius['2xl']}>
          <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 14 }}>
            <View style={{ flex: 1 }}>
              <Text className="font-display" style={{ fontSize: 24, color: tokens.textOnBrand }}>
                {t('home.cta.title')}
              </Text>
              <Text
                className="font-body"
                style={{ fontSize: 16, color: tokens.textOnBrand, marginTop: 2 }}
              >
                {t(nextSlot === 'morning' ? 'home.cta.morning' : 'home.cta.evening')}
              </Text>
            </View>
            <Card
              onPress={() => router.push('/session')}
              accessibilityLabel={t('common.startBrushing')}
              padding={0}
              radius={radius.pill}
              style={{
                width: 60,
                height: 60,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: palette.sunny[500],
              }}
            >
              <Play size={28} color={tokens.textPrimary} weight="fill" />
            </Card>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
