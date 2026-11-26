import { Pause } from 'phosphor-react-native';
import { Text, View, type ViewStyle } from 'react-native';

import { colors, radius } from '@/lib/tokens';

type BadgeTone = 'primary' | 'symptom' | 'neutral';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  solid?: boolean;
  style?: ViewStyle;
}

/** Badge — small status or reward pill. */
export function Badge({ label, tone = 'primary', solid = false, style }: BadgeProps) {
  const solidPrimary = tone === 'primary' && solid;
  const bg = tone === 'symptom' ? colors.symptomSoft
    : tone === 'neutral' ? colors.zoneEmpty
    : solidPrimary ? colors.primary : colors.primarySoft;
  const fg = tone === 'symptom' ? colors.symptomInk
    : solidPrimary ? colors.onPrimary : colors.ink;

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          columnGap: 6,
          minHeight: 30,
          paddingHorizontal: 12,
          borderRadius: radius.pill,
          backgroundColor: bg,
        },
        style,
      ]}
    >
      {tone === 'symptom' ? (
        <View accessible={false} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.symptom }} />
      ) : null}
      {tone === 'neutral' ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Pause size={14} weight="fill" color={colors.ink} />
        </View>
      ) : null}
      <Text className="font-display-semi" style={{ color: fg, fontSize: 16, lineHeight: 20 }}>
        {label}
      </Text>
    </View>
  );
}
