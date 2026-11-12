import { Fire, type IconProps, LockSimple, Star, Tooth, Trophy } from 'phosphor-react-native';
import type { ComponentType } from 'react';
import { Text, View, type ViewStyle } from 'react-native';

import type { Badge } from '@/types';
import { t } from '@/lib/i18n';
import { hardShadow, outline, palette, radius, tokens } from '@/lib/tokens';

type BadgeType = Badge['type'];

// Light fills carry an ink icon; only cobalt / bubblegum-600 carry white.
const BADGE_META: Record<BadgeType, { Icon: ComponentType<IconProps>; color: string; fg: string }> = {
  streak: { Icon: Fire, color: palette.sunny[500], fg: tokens.textPrimary },
  perfect: { Icon: Star, color: palette.cobalt[500], fg: tokens.textOnBrand },
  firstSession: { Icon: Tooth, color: palette.sky[400], fg: tokens.textPrimary },
  weeklyGoal: { Icon: Trophy, color: palette.bubblegum[600], fg: tokens.textOnBrand },
};

interface BadgeCardProps {
  type?: BadgeType;
  earned?: boolean;
  style?: ViewStyle;
}

/** BadgeCard — a kid's achievement reward. Earned = full color + toy outline; locked = dashed + greyed. */
export function BadgeCard({ type = 'firstSession', earned = true, style }: BadgeCardProps) {
  const meta = BADGE_META[type];
  return (
    <View
      style={[
        {
          alignItems: 'center',
          rowGap: 10,
          width: 116,
          paddingVertical: 18,
          paddingHorizontal: 12,
          borderRadius: radius.xl,
          backgroundColor: tokens.surfaceCard,
          opacity: earned ? 1 : 0.6,
        },
        earned ? hardShadow(6) : { borderWidth: 3, borderColor: palette.ink[300], borderStyle: 'dashed' },
        style,
      ]}
    >
      <View
        style={[
          {
            width: 64,
            height: 64,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: earned ? meta.color : palette.ink[100],
          },
          earned ? outline : null,
        ]}
      >
        {earned ? (
          <meta.Icon size={34} color={meta.fg} weight="fill" />
        ) : (
          <LockSimple size={34} color={palette.ink[400]} weight="bold" />
        )}
      </View>
      <Text className="font-display-semi" style={{ fontSize: 15, color: tokens.textPrimary, textAlign: 'center' }}>
        {t(`badge.${type}`)}
      </Text>
    </View>
  );
}
