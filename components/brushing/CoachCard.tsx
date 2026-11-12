import { Text, View, type ViewStyle } from 'react-native';

import { BeavoMark } from '@/components/brand/BeavoBrand';
import { t } from '@/lib/i18n';
import { cardShadow, radius, tokens } from '@/lib/tokens';

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
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          columnGap: 14,
          padding: 18,
          borderRadius: radius.xl,
          backgroundColor: tokens.surfaceCard,
          alignItems: 'flex-start',
        },
        cardShadow,
        style,
      ]}
    >
      <BeavoMark width={60} />
      <View style={{ flex: 1, rowGap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}>
          <Text className="font-display" style={{ fontSize: 17, color: tokens.brandPrimary }}>
            {t('coach.says')}
          </Text>
          {score != null ? (
            <View
              style={{ backgroundColor: tokens.brandPrimary, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 1 }}
            >
              <Text className="font-numeric" style={{ fontSize: 14, color: tokens.textOnBrand }}>
                {score}/100
              </Text>
            </View>
          ) : null}
        </View>
        <Text className="font-body" style={{ fontSize: 17, lineHeight: 25, color: tokens.textPrimary }}>
          {message}
        </Text>
      </View>
    </View>
  );
}
