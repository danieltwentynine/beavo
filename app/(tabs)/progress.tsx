import { router } from 'expo-router';
import { CaretRight, Tooth } from 'phosphor-react-native';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Circle, G, Rect, Svg } from 'react-native-svg';

import { BeavoMark } from '@/components/brand/BeavoBrand';
import { BadgeCard } from '@/components/kids/BadgeCard';
import { Card } from '@/components/ui/Card';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { TabHeader } from '@/components/ui/TabHeader';
import { TabScenery } from '@/components/ui/TabScenery';
import { useActiveChild } from '@/hooks/useActiveChild';
import { useSessionHistory } from '@/hooks/useSessions';
import { t } from '@/lib/i18n';
import { colors, radius } from '@/lib/tokens';
import { localDate } from '@/src/data/schedule';
import { summarizeProgress } from '@/src/data/progress';

const WEEKDAYS = t('progress.weekdays').split(',');

const DAM_LOGS = [104, 84, 64, 44];
const RING_RADIUS = 29;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function Dam({ days }: { days: number }) {
  return (
    <View style={{ rowGap: 4, marginTop: 8 }}>
      <Svg width={92} height={52} viewBox="0 0 120 68" accessible={false} importantForAccessibility="no-hide-descendants">
        {DAM_LOGS.map((width, index) => {
          const filled = index < days;
          const x = (120 - width) / 2;
          const y = 52 - 16 * index;
          return (
            <G key={width}>
              <Rect x={x} y={y} width={width} height={13} rx={6.5}
                fill={filled ? colors.fur : 'none'} stroke={filled ? colors.fur : colors.zoneLine}
                strokeWidth={2} strokeDasharray={filled ? undefined : [4, 4]} />
              {filled ? <Circle cx={x + width - 6.5} cy={y + 6.5} r={6.5} fill={colors.furLight} /> : null}
            </G>
          );
        })}
      </Svg>
      <Text className="font-body" style={{ fontSize: 16, color: colors.inkMuted }}>
        {t('progress.damDays', { count: days })}
      </Text>
    </View>
  );
}

function CompletionRing({ rate }: { rate: number | null }) {
  const value = rate === null ? t('progress.rateNone') : `${Math.round(rate * 100)}%`;
  return (
    <View style={{ minWidth: 72, minHeight: 72, alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={72} height={72} viewBox="0 0 72 72" accessible={false} style={{ position: 'absolute' }}>
        <Circle cx={36} cy={36} r={RING_RADIUS} fill="none" stroke={colors.primarySoft} strokeWidth={8} />
        {rate !== null && rate > 0 ? (
          <Circle cx={36} cy={36} r={RING_RADIUS} fill="none" stroke={colors.primary} strokeWidth={8}
            strokeLinecap="round" strokeDasharray={[RING_LENGTH, RING_LENGTH]}
            strokeDashoffset={RING_LENGTH * (1 - rate)} transform="rotate(-90 36 36)" />
        ) : null}
      </Svg>
      <Text className="font-numeric" style={{ marginHorizontal: 10, fontSize: 18, color: colors.ink }}>{value}</Text>
    </View>
  );
}

/** Streak, completion rate, this week by slot, badges, and the way into the full history. Active child only. */
export default function ProgressTab() {
  const { slots } = useActiveChild();
  const history = useSessionHistory();
  const sessions = history?.items ?? [];
  const damDays = new Set(sessions.filter((session) => session.durationSec > 0).map((session) => session.date)).size;
  const { width, fontScale } = useWindowDimensions();
  const stackStats = width < 340 || fontScale >= 1.5;
  const now = new Date();
  const today = localDate(now);
  const summary = summarizeProgress(slots, sessions, now);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <TabScenery />
      <ScrollView contentContainerStyle={{ width: '100%', maxWidth: 560, alignSelf: 'center', padding: 20, paddingTop: 4, rowGap: 22 }}>
        <TabHeader title={t('progress.title')} />

        <View style={{ flexDirection: stackStats ? 'column' : 'row', gap: 12 }}>
          <Card padding={14} style={{ flex: 1, rowGap: 4, backgroundColor: colors.surfaceWarm }}>
            <Text className="font-numeric" style={{ fontSize: 36, lineHeight: 42, color: colors.ink }}>
              {t('progress.days', { count: summary.currentStreak })}
            </Text>
            <Text className="font-body-semi" style={{ fontSize: 17, color: colors.ink }}>{t('progress.streak')}</Text>
            <Text className="font-body" style={{ fontSize: 16, color: colors.inkMuted }}>
              {t('progress.best', { count: summary.bestStreak })}
            </Text>
            {history ? <Dam days={damDays} /> : null}
          </Card>
          <Card padding={14} style={{ flex: 1, rowGap: 4 }}>
            <CompletionRing rate={summary.completionRate} />
            <Text className="font-body-semi" style={{ marginTop: 4, fontSize: 17, color: colors.ink }}>{t('progress.rate')}</Text>
            <Text className="font-body" style={{ fontSize: 16, color: colors.inkMuted }}>{t('progress.rateHint')}</Text>
          </Card>
        </View>

        <Card padding={12}>
          <SectionTitle>{t('progress.thisWeek')}</SectionTitle>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 24 }}>
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
                    flex: 1,
                    maxWidth: 44,
                    borderRadius: radius.md,
                    backgroundColor: isToday ? colors.primarySoft : 'transparent',
                    borderWidth: isToday ? 3 : 0,
                    borderColor: colors.primary,
                  }}
                >
                  {isToday ? (
                    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
                      style={{ position: 'absolute', top: -29 }}>
                      <BeavoMark width={32} accessible={false} />
                    </View>
                  ) : null}
                  <Text className="font-display-semi" style={{ fontSize: 16, color: isToday ? colors.primary : colors.inkMuted }}>
                    {WEEKDAYS[i]}
                  </Text>
                  {day.slots.map((s) => (
                    <Tooth key={s.slotId} size={19} weight={s.done ? 'fill' : 'regular'}
                      color={s.done ? colors.primary : colors.zoneLine} />
                  ))}
                </View>
              );
            })}
          </View>
        </Card>

        <View>
          <SectionTitle>{t('progress.badges')}</SectionTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ columnGap: 12, paddingVertical: 8, paddingHorizontal: 6 }}>
            <BadgeCard type="firstSession" earned={summary.badges.firstSession} style={{ transform: [{ rotate: '-2deg' }] }} />
            <BadgeCard type="streak" earned={summary.badges.streak} style={{ transform: [{ rotate: '1.5deg' }] }} />
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
            <Text className="font-display-semi" style={{ fontSize: 18, color: colors.ink }}>
              {t('progress.history')}
            </Text>
            <Text className="font-body" style={{ fontSize: 16, color: colors.inkMuted }}>
              {t('progress.historyCount', { count: sessions.length })}
            </Text>
          </View>
          <CaretRight size={22} color={colors.ink} weight="bold" />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
