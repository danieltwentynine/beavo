import { Fire, type IconProps, LockSimple, Star, Tooth, Trophy } from 'phosphor-react-native';
import type { ComponentType } from 'react';
import { Text, View, type ViewStyle } from 'react-native';

import { t } from '@/lib/i18n';
import type { BadgeType } from '@/types';
import { colors, radius, shadow } from '@/lib/tokens';

// Each fill is paired with its on-colour (white on primary, reward and ink; ink-green on secondary).
const BADGE_META: Record<BadgeType, { Icon: ComponentType<IconProps>; color: string; fg: string; label: string }> = {
  streak: { Icon: Fire, color: colors.reward, fg: colors.onReward, label: t('badge.streak') },
  perfect: { Icon: Star, color: colors.primary, fg: colors.onPrimary, label: t('badge.perfect') },
  firstSession: { Icon: Tooth, color: colors.secondary, fg: colors.onSecondary, label: t('badge.firstSession') },
  weeklyGoal: { Icon: Trophy, color: colors.ink, fg: colors.onPrimary, label: t('badge.weeklyGoal') },
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
      accessible
      accessibilityRole="image"
      accessibilityLabel={earned ? meta.label : t('badge.locked', { badge: meta.label })}
      style={[
        {
          alignItems: 'center',
          rowGap: 10,
          width: 116,
          paddingVertical: 18,
          paddingHorizontal: 12,
          borderRadius: radius.lg,
          backgroundColor: earned ? colors.surface : colors.surfaceWarm,
        },
        earned ? shadow.card : { borderWidth: 2, borderColor: colors.zoneLine, borderStyle: 'dashed' },
        style,
      ]}
    >
      {!earned ? (
        <LockSimple size={14} color={colors.inkMuted} weight="bold" style={{ position: 'absolute', top: 8, right: 8 }} />
      ) : null}
      <View
        style={{
            width: 64,
            height: 64,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: earned ? meta.color : colors.zoneEmpty,
          }}
      >
        <meta.Icon size={34} color={earned ? meta.fg : colors.inkMuted} weight={earned ? 'fill' : 'regular'} />
      </View>
      <Text className="font-display-semi" style={{ fontSize: 16, color: colors.ink, textAlign: 'center' }}>
        {meta.label}
      </Text>
    </View>
  );
}
