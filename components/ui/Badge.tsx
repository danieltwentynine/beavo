import { Pause } from 'phosphor-react-native';
import { Text, View, type ViewStyle } from 'react-native';

import { radius, tokens } from '@/lib/tokens';

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
  const bg = tone === 'symptom' ? tokens.symptomSoft
    : tone === 'neutral' ? tokens.zoneEmpty
    : solidPrimary ? tokens.brandPrimary : tokens.primarySoft;
  const fg = tone === 'symptom' ? tokens.symptomInk
    : solidPrimary ? tokens.textOnBrand : tokens.textPrimary;

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
        <View accessible={false} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.symptom }} />
      ) : null}
      {tone === 'neutral' ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Pause size={14} weight="fill" color={tokens.textPrimary} />
        </View>
      ) : null}
      <Text className="font-display-semi" style={{ color: fg, fontSize: 14, lineHeight: 17 }}>
        {label}
      </Text>
    </View>
  );
}
