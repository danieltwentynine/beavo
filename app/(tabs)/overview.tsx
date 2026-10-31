import { router } from 'expo-router';
import { CheckCircle, Play } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SlotIcon } from '@/components/brushing/SlotIcon';
import { Card } from '@/components/ui/Card';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { TabHeader } from '@/components/ui/TabHeader';
import { useActiveChild } from '@/hooks/useActiveChild';
import { db } from '@/lib/firebase';
import { t } from '@/lib/i18n';
import { outline, palette, radius, tokens } from '@/lib/tokens';
import { useAuthStore } from '@/stores/authStore';
import { localDate, slotsActiveOn } from '@/src/data/schedule';
import { watchSessionsOn } from '@/src/data/sessions';
import type { BrushingSession } from '@/types';

const formatTime = (date: Date) => date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

function greeting(hour: number): string {
  if (hour < 12) return t('greeting.morning');
  if (hour < 18) return t('greeting.afternoon');
  return t('greeting.evening');
}

export default function OverviewScreen() {
  const user = useAuthStore((s) => s.user);
  const { child, slots } = useActiveChild();
  const today = localDate(new Date());
  const watchKey = user && child ? `${user.uid}/${child.id}/${today}` : null;
  const [watched, setWatched] = useState<{ key: string; sessions: BrushingSession[] } | null>(null);
  // Sessions of another child/day never flash while the new listener starts.
  const sessions = watched && watched.key === watchKey ? watched.sessions : [];

  useEffect(() => {
    if (!user || !child || !watchKey) return;
    return watchSessionsOn(db, user.uid, child.id, today, (list) => setWatched({ key: watchKey, sessions: list }));
  }, [user, child, today, watchKey]);

  const todaySlots = slotsActiveOn(slots, today);
  const parentName = user?.displayName?.split(' ')[0] || t('greeting.fallbackName');

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.surfacePage }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, rowGap: 22 }}>
        <TabHeader>
          <Text className="font-body-semi" style={{ fontSize: 14, color: tokens.textSecondary }}>
            {greeting(new Date().getHours())}
          </Text>
          <Text className="font-display" style={{ fontSize: 26, color: tokens.textPrimary }} numberOfLines={1}>
            {parentName}
          </Text>
        </TabHeader>

        <View>
          <SectionTitle>{t('overview.today')}</SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {todaySlots.map((slot) => {
              const done = sessions.find((s) => s.slotId === slot.id);
              return (
                <Card key={slot.id} padding={14} style={{ flexGrow: 1, flexBasis: '30%', alignItems: 'center' }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      marginBottom: 8,
                      borderRadius: radius.pill,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: done ? tokens.surfaceMint : tokens.surfaceSunken,
                      ...outline,
                    }}
                  >
                    {done ? (
                      <CheckCircle size={24} color={tokens.brandPrimary} weight="fill" />
                    ) : (
                      <SlotIcon icon={slot.icon} size={24} color={tokens.textTertiary} weight="fill" />
                    )}
                  </View>
                  <Text className="font-display-semi" style={{ fontSize: 15, color: tokens.textPrimary, textAlign: 'center' }}>
                    {slot.label}
                  </Text>
                  <Text className="font-body-semi" style={{ fontSize: 13, color: done ? tokens.textLink : tokens.textTertiary }}>
                    {done ? t('overview.done', { time: formatTime(done.startedAt) }) : t('overview.notYet')}
                  </Text>
                </Card>
              );
            })}
          </View>
        </View>

        <Card tone="cobalt" padding={20} radius={radius['2xl']}>
          <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 14 }}>
            <View style={{ flex: 1 }}>
              <Text className="font-display" style={{ fontSize: 24, color: tokens.textOnBrand }}>
                {t('overview.cta')}
              </Text>
              <Text className="font-body" style={{ fontSize: 16, color: tokens.textOnBrand, marginTop: 2 }}>
                {t('overview.ctaBody', { name: child?.name ?? '' })}
              </Text>
            </View>
            <Card
              onPress={() => router.push('/session')}
              accessibilityLabel={t('overview.start')}
              padding={0}
              radius={radius.pill}
              style={{ width: 60, height: 60, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.sunny[500] }}
            >
              <Play size={28} color={tokens.textPrimary} weight="fill" />
            </Card>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
