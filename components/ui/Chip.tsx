import { useState } from 'react';
import { Pressable, Text, type ViewStyle } from 'react-native';

import { cardShadow, motion, radius, tokens } from '@/lib/tokens';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

/**
 * Chip — a selectable pill (e.g. choosing a child's age).
 * Big tap target (min 48px), primary fill when selected.
 */
export function Chip({
  label,
  selected = false,
  onPress,
  style,
  accessibilityLabel,
}: ChipProps) {
  // Pressed state lives in React state because NativeWind's runtime drops
  // Pressable's function-form style prop (nativewind/nativewind#1105) —
  // style={({ pressed }) => ...} renders completely unstyled here.
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          columnGap: 8,
          minHeight: 48,
          paddingHorizontal: 18,
          borderRadius: radius.pill,
          backgroundColor: selected ? tokens.brandPrimary : tokens.surfaceCard,
          transform: [{ scale: pressed ? motion.pressScale : 1 }, { translateY: pressed ? 2 : 0 }],
        },
        cardShadow,
        style,
      ]}
    >
      <Text
        className="font-display"
        style={{ color: selected ? tokens.textOnBrand : tokens.textPrimary, fontSize: 18 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
