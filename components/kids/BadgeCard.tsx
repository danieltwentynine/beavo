import { Fire, type IconProps, LockSimple, Star, Tooth, Trophy } from 'phosphor-react-native';
import type { ComponentType } from 'react';
import { Text, View, type ViewStyle } from 'react-native';

import { t } from '@/lib/i18n';
import type { BadgeType } from '@/types';
import { cardShadow, radius, tokens } from '@/lib/tokens';

// Each fill is paired with its on-colour (white on primary, reward and ink; ink-green on secondary).
const BADGE_META: Record<BadgeType, { Icon: ComponentType<IconProps>; color: string; fg: string; label: string }> = {
  streak: { Icon: Fire, color: tokens.reward, fg: tokens.onReward, label: t('badge.streak') },
  perfect: { Icon: Star, color: tokens.brandPrimary, fg: tokens.textOnBrand, label: t('badge.perfect') },
  firstSession: { Icon: Tooth, color: tokens.secondary, fg: tokens.onSecondary, label: t('badge.firstSession') },
  weeklyGoal: { Icon: Trophy, color: tokens.textPrimary, fg: tokens.textOnBrand, label: t('badge.weeklyGoal') },
};

interface BadgeCardProps {
  type?: BadgeType;
  earned?: boolean;
  style?: ViewStyle;
}

/** BadgeCard — a kid's achievement reward. Earned = full color on a lifted card; locked = dashed + greyed. */
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
          borderRadius: radius.lg,
          backgroundColor: tokens.surfaceCard,
          opacity: earned ? 1 : 0.6,
        },
        earned ? cardShadow : { borderWidth: 2, borderColor: tokens.zoneLine, borderStyle: 'dashed' },
        style,
      ]}
    >
      <View
        style={{
            width: 64,
            height: 64,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: earned ? meta.color : tokens.zoneEmpty,
          }}
      >
        {earned ? (
          <meta.Icon size={34} color={meta.fg} weight="fill" />
        ) : (
          <LockSimple size={34} color={tokens.textSecondary} weight="bold" />
        )}
      </View>
      <Text className="font-display-semi" style={{ fontSize: 15, color: tokens.textPrimary, textAlign: 'center' }}>
        {meta.label}
      </Text>
    </View>
  );
}
