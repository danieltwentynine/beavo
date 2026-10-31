import { router } from 'expo-router';
import { CaretRight } from 'phosphor-react-native';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BadgeCard } from '@/components/kids/BadgeCard';
import { Card } from '@/components/ui/Card';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { TabHeader } from '@/components/ui/TabHeader';
import { useActiveChild } from '@/hooks/useActiveChild';
import { useSessions } from '@/hooks/useSessions';
import { t } from '@/lib/i18n';
import { outline, palette, radius, tokens } from '@/lib/tokens';
import { localDate } from '@/src/data/schedule';
import { summarizeProgress } from '@/src/data/progress';

const WEEKDAYS = t('progress.weekdays').split(',');

function StatCard({ value, label, hint }: { value: string; label: string; hint: string }) {
  return (
    <Card padding={16} style={{ flex: 1, rowGap: 2 }}>
      <Text className="font-numeric" style={{ fontSize: 34, lineHeight: 40, color: tokens.textPrimary }}>
        {value}
      </Text>
      <Text className="font-body-semi" style={{ fontSize: 15, color: tokens.textPrimary }}>
        {label}
      </Text>
      <Text className="font-body" style={{ fontSize: 13, color: tokens.textSecondary }}>
        {hint}
      </Text>
    </Card>
  );
}

/** Streak, completion rate, this week by slot, badges, and the way into the full history. Active child only. */
export default function ProgressTab() {
  const { slots } = useActiveChild();
  const sessions = useSessions();
  const now = new Date();
  const today = localDate(now);
  const summary = summarizeProgress(slots, sessions, now);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.surfacePage }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, rowGap: 22 }}>
        <TabHeader title={t('progress.title')} />

        <View style={{ flexDirection: 'row', columnGap: 12 }}>
          <StatCard
            value={t('progress.days', { count: summary.currentStreak })}
            label={t('progress.streak')}
            hint={t('progress.best', { count: summary.bestStreak })}
          />
          <StatCard
            value={summary.completionRate === null ? t('progress.rateNone') : `${Math.round(summary.completionRate * 100)}%`}
            label={t('progress.rate')}
            hint={t('progress.rateHint')}
          />
        </View>

        <Card padding={16}>
          <SectionTitle>{t('progress.thisWeek')}</SectionTitle>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {summary.week.map((day, i) => {
              const isToday = day.date === today;
              const done = day.slots.filter((s) => s.done).length;
              return (
                <View
                  key={day.date}
                  accessible
                  accessibilityLabel={`${t('progress.dayA11y', { day: WEEKDAYS[i], done, total: day.slots.length })}${isToday ? `, ${t('progress.today')}` : ''}`}
                  style={{
                    alignItems: 'center',
                    rowGap: 6,
                    paddingVertical: 8,
                    width: 40,
                    borderRadius: radius.lg,
                    backgroundColor: isToday ? palette.cobalt[100] : 'transparent',
                    borderWidth: isToday ? 3 : 0,
                    borderColor: tokens.brandPrimary,
                  }}
                >
                  <Text className="font-display-semi" style={{ fontSize: 15, color: isToday ? tokens.textLink : tokens.textSecondary }}>
                    {WEEKDAYS[i]}
                  </Text>
                  {day.slots.map((s) => (
                    <View
                      key={s.slotId}
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        backgroundColor: s.done ? tokens.brandPrimary : tokens.surfaceCard,
                        ...outline,
                        borderWidth: 2,
                      }}
                    />
                  ))}
                </View>
              );
            })}
          </View>
        </Card>

        <View>
          <SectionTitle>{t('progress.badges')}</SectionTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ columnGap: 12, paddingBottom: 10, paddingHorizontal: 2 }}>
            <BadgeCard type="firstSession" earned={summary.badges.firstSession} />
            <BadgeCard type="streak" earned={summary.badges.streak} />
            <BadgeCard type="weeklyGoal" earned={summary.badges.weeklyGoal} />
          </ScrollView>
        </View>

        <Card
          padding={18}
          onPress={() => router.push('/brushing-history')}
          accessibilityLabel={`${t('progress.history')}, ${t('progress.historyCount', { count: sessions.length })}`}
          style={{ flexDirection: 'row', alignItems: 'center', columnGap: 12 }}
        >
          <View style={{ flex: 1 }}>
            <Text className="font-display-semi" style={{ fontSize: 18, color: tokens.textPrimary }}>
              {t('progress.history')}
            </Text>
            <Text className="font-body" style={{ fontSize: 14, color: tokens.textSecondary }}>
              {t('progress.historyCount', { count: sessions.length })}
            </Text>
          </View>
          <CaretRight size={22} color={tokens.textPrimary} weight="bold" />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
