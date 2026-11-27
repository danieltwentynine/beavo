import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { BeavoMark } from '@/components/brand/BeavoBrand';
import { Card } from '@/components/ui/Card';
import { locale, t, type StringKey } from '@/lib/i18n';
import { colors, radius } from '@/lib/tokens';

export type TrailKind = 'brushed' | 'frozen' | 'bridged' | 'water';

const LABELS: Record<TrailKind, StringKey> = {
  brushed: 'trail.brushed',
  frozen: 'trail.rest',
  bridged: 'trail.bridge',
  water: 'trail.water',
};

const DATE = new Intl.DateTimeFormat(locale, {
  weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
});

function Stone({ kind }: { kind: TrailKind }) {
  return (
    <Svg width="100%" height={32} viewBox="0 0 32 32" accessible={false}>
      {kind === 'brushed' ? (
        <>
          <Path d="M5 20C4 15 8 7 16 7C23 6 28 12 28 18C28 24 23 26 17 26C10 26 6 24 5 20Z"
            fill={colors.stone} stroke={colors.stoneLine} strokeWidth={1.6} />
          <Path d="M10 14Q13 10 18 11" fill="none" stroke={colors.surface} strokeWidth={2.2} strokeLinecap="round" />
          <Circle cx={22} cy={13} r={1.2} fill={colors.surface} />
        </>
      ) : kind === 'frozen' ? (
        <>
          <Rect x={6} y={6} width={20} height={20} rx={4} fill={colors.iceSoft} stroke={colors.iceLine} strokeWidth={2}
            transform="rotate(-9 16 16)" />
          <Path d="M16 10v12m-5-9 10 6m-10 0 10-6"
            fill="none" stroke={colors.iceLine} strokeWidth={1.7} strokeLinecap="round" />
        </>
      ) : kind === 'bridged' ? (
        <>
          <Path d="M5 21Q16 11 27 21M7 23v3m18-3v3" fill="none" stroke={colors.furDark} strokeWidth={2} strokeLinecap="round" />
          <Rect x={6} y={15} width={7} height={9} rx={2} fill={colors.fur} transform="rotate(-18 9.5 19.5)" />
          <Rect x={13} y={12} width={7} height={9} rx={2} fill={colors.fur} />
          <Rect x={20} y={15} width={7} height={9} rx={2} fill={colors.fur} transform="rotate(18 23.5 19.5)" />
        </>
      ) : null}
    </Svg>
  );
}

export function StreakTrail({ current, best, days, children }: {
  current: number | null;
  best: number | null;
  days: readonly { date: string; kind: TrailKind }[];
  children?: ReactNode;
}) {
  const lastBrushed = days.findLast(({ kind }) => kind === 'brushed')?.date;

  return (
    <Card padding={16} radius={radius.xl} style={{ rowGap: 10, backgroundColor: colors.surfaceWarm }}>
      <Text accessibilityRole="header" className="font-display" style={{ fontSize: 22, color: colors.ink }}>
        {t('trail.title')}
      </Text>
      {current === null ? (
        <Text className="font-body" style={{ fontSize: 16, color: colors.inkMuted }}>{t('trail.loading')}</Text>
      ) : current > 0 ? (
        <Text className="font-numeric" style={{ fontSize: 36, color: colors.ink }}>
          {t('trail.count', { count: current })}
        </Text>
      ) : best === 0 ? (
        <Text className="font-body" style={{ fontSize: 16, color: colors.inkMuted }}>{t('trail.empty')}</Text>
      ) : null}
      {days.length > 0 ? (
        <View style={{ minHeight: 56, position: 'relative', flexDirection: 'row', alignItems: 'center',
          backgroundColor: colors.sceneWater, paddingHorizontal: 4, borderRadius: radius.md }}>
          <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
            <Svg width="100%" height="100%" viewBox="0 0 280 56" preserveAspectRatio="none" accessible={false}>
              <Path d="M0 19q12-4 24 0t24 0m54 19q12-4 24 0t24 0m71-19q12-4 24 0t24 0"
                fill="none" stroke={colors.surface} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </View>
          {days.map(({ date, kind }) => (
            <View key={date} accessible accessibilityRole="image"
              accessibilityLabel={t('trail.dayLabel', { date: DATE.format(new Date(date + 'T00:00:00Z')), state: t(LABELS[kind]) })}
              style={{ alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 44 }}>
              {kind === 'water' ? null : (
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
                  style={{ width: '100%', maxWidth: 32 }}>
                  <Stone kind={kind} />
                </View>
              )}
              {date === lastBrushed ? (
                <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
                  style={{ position: 'absolute', top: -7 }}>
                  <BeavoMark width={20} accessible={false} />
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
      <Text className="font-body-semi" style={{ fontSize: 16, color: colors.inkMuted }}>
        {best === null ? t('trail.bestLoading') : t('trail.best', { best, count: best })}
      </Text>
      {children}
    </Card>
  );
}
