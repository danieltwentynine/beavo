import { Text, View, type ViewStyle } from 'react-native';

import { BeavoMark } from '@/components/brand/BeavoBrand';
import { useReduceTransparency } from '@/hooks/useReduceTransparency';
import { t } from '@/lib/i18n';
import { colors, radius, shadow } from '@/lib/tokens';

interface CoachCardProps {
  message: string;
  score?: number | null;
  style?: ViewStyle;
}

/**
 * CoachCard — the post-session coaching message from Beavo. Warm, playful,
 * never clinical (docs/CLINICAL.md). Optional score chip.
 */
export function CoachCard({ message, score = null, style }: CoachCardProps) {
  const reduceTransparency = useReduceTransparency();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          columnGap: 14,
          padding: 18,
          borderRadius: radius.xl,
          backgroundColor: reduceTransparency ? colors.glassSessionSolid : colors.sessionPill,
          alignItems: 'flex-start',
        },
        shadow.card,
        style,
      ]}
    >
      <BeavoMark width={60} />
      <View style={{ flex: 1, rowGap: 6 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <Text className="font-display" style={{ fontSize: 17, color: colors.primaryPress }}>
            {t('coach.says')}
          </Text>
          {score != null ? (
            <View
              style={{ backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 1 }}
            >
              <Text className="font-numeric" style={{ fontSize: 16, color: colors.onPrimary }}>
                {score}/100
              </Text>
            </View>
          ) : null}
        </View>
        <Text className="font-body" style={{ fontSize: 17, lineHeight: 25, color: colors.ink }}>
          {message}
        </Text>
      </View>
    </View>
  );
}
