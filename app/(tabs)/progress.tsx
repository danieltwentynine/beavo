import { useFocusEffect } from 'expo-router';
import { Check } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BadgeCard } from '@/components/kids/BadgeCard';
import { StreakDisplay } from '@/components/kids/StreakDisplay';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { useActiveChild } from '@/hooks/useActiveChild';
import { locale, t } from '@/lib/i18n';
import { sameDay } from '@/lib/streak';
import { fetchRecentSessions, type RecentSession } from '@/lib/sessions';
import { outline, radius, tokens } from '@/lib/tokens';
import type { Badge as BadgeType } from '@/types';

const BADGE_TYPES: BadgeType['type'][] = ['firstSession', 'streak', 'perfect', 'weeklyGoal'];
const HISTORY_LENGTH = 5;

function formatSessionDay(date: Date): string {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayMs = 86400000;
  const diffDays = Math.floor((startOfToday.getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / dayMs);
  const slot = date.getHours() < 12 ? t('common.morning') : t('common.evening');
  if (diffDays <= 0) return t('progress.today', { slot });
  if (diffDays === 1) return t('progress.yesterday', { slot });
  // Portuguese and Spanish weekdays are lowercase; this one starts the line.
  const weekday = date.toLocaleDateString(locale, { weekday: 'long' });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} · ${slot}`;
}

/** Mon–Sun of the current week, marked done when any session landed that day. */
function buildWeek(sessions: RecentSession[]): { d: string; done: boolean }[] {
  const now = new Date();
  const mondayOffset = (now.getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset + i);
    const d = day.toLocaleDateString(locale, { weekday: 'narrow' }).toUpperCase();
    return { d, done: sessions.some((s) => sameDay(s.completedAt, day)) };
  });
}

export default function ProgressScreen() {
  const { child } = useActiveChild();
  const [sessions, setSessions] = useState<RecentSession[] | null>(null);

  // Re-fetch on focus so the session just brushed appears immediately
  // (tab screens stay mounted, so a mount-only effect goes stale).
  useFocusEffect(
    useCallback(() => {
      if (!child) return;
      let cancelled = false;
      // 30 covers the week strip (max 14/wk) plus the history list.
      fetchRecentSessions(child.parentUid, child.id, 30).then((s) => {
        if (!cancelled) setSessions(s);
      });
      return () => {
        cancelled = true;
      };
    }, [child]),
  );

  const week = buildWeek(sessions ?? []);
  const earnedBadgeTypes = new Set((child?.badges ?? []).map((b) => b.type));
  const history = (sessions ?? [])
    .slice(0, HISTORY_LENGTH)
    .map((s) => ({ id: s.id, day: formatSessionDay(s.completedAt), score: s.score }));

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.surfacePage }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, rowGap: 22 }}>
        <Text className="font-display" style={{ fontSize: 28, color: tokens.textPrimary }}>
          {child?.name ? t('progress.titleNamed', { name: child.name }) : t('progress.title')}
        </Text>

        <StreakDisplay days={child?.streakCurrent ?? 0} best={child?.streakBest ?? 0} />

        {/* This week */}
        <Card padding={18}>
          <SectionTitle>{t('progress.week')}</SectionTitle>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {week.map((w, i) => (
              <View key={i} style={{ alignItems: 'center', rowGap: 8 }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: radius.pill,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: w.done ? tokens.brandPrimary : tokens.surfaceSunken,
                    ...outline,
                  }}
                >
                  {w.done ? <Check size={16} color="#fff" weight="bold" /> : null}
                </View>
                <Text className="font-body-semi" style={{ fontSize: 14, color: tokens.textSecondary }}>
                  {w.d}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Badges */}
        <View>
          <SectionTitle>{t('progress.badges')}</SectionTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ columnGap: 12, paddingBottom: 10, paddingHorizontal: 2 }}>
            {BADGE_TYPES.map((type) => (
              <BadgeCard key={type} type={type} earned={earnedBadgeTypes.has(type)} />
            ))}
          </ScrollView>
        </View>

        {/* History */}
        <View>
          <SectionTitle>{t('progress.recent')}</SectionTitle>
          {history.length > 0 ? (
            <Card padding={6}>
              {history.map((h, i) => (
                <View
                  key={h.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderBottomWidth: i < history.length - 1 ? 2 : 0,
                    borderBottomColor: tokens.borderSubtle,
                  }}
                >
                  <Text className="font-body-semi" style={{ fontSize: 16, color: tokens.textPrimary }}>
                    {h.day}
                  </Text>
                  <Badge
                    tone={h.score >= 80 ? 'cobalt' : 'warning'}
                    solid={h.score >= 80}
                    label={`${h.score}/100`}
                  />
                </View>
              ))}
            </Card>
          ) : (
            <Card padding={18}>
              <Text className="font-body" style={{ fontSize: 16, color: tokens.textSecondary }}>
                {t('progress.empty')}
              </Text>
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
