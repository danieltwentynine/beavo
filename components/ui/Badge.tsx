import { Text, View, type ViewStyle } from 'react-native';

import { radius, tokens } from '@/lib/tokens';

type BadgeTone = 'primary' | 'warning';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  solid?: boolean;
  style?: ViewStyle;
}

// [soft background, solid background, text on solid]. Soft always takes ink text;
// white only on primary.
const TONES: Record<BadgeTone, [string, string, string]> = {
  primary: [tokens.primarySoft, tokens.brandPrimary, tokens.textOnBrand],
  warning: [tokens.warning, tokens.warning, tokens.textPrimary],
};

/** Badge — small status / reward pill. */
export function Badge({ label, tone = 'primary', solid = false, style }: BadgeProps) {
  const [bg, solidBg, solidFg] = TONES[tone];
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          columnGap: 6,
          height: 30,
          paddingHorizontal: 12,
          borderRadius: radius.pill,
          backgroundColor: solid ? solidBg : bg,
        },
        style,
      ]}
    >
      <Text
        className="font-display-semi"
        style={{ color: solid ? solidFg : tokens.textPrimary, fontSize: 14, lineHeight: 17 }}
      >
        {label}
      </Text>
    </View>
  );
}
