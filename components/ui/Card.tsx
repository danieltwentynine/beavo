import { useState, type ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { cardShadow, radius, tokens } from '@/lib/tokens';

type CardTone = 'plain' | 'soft' | 'primary';

interface CardProps {
  children: ReactNode;
  tone?: CardTone;
  padding?: number;
  radius?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

const TONES: Record<CardTone, string> = {
  plain: tokens.surfaceCard,
  soft: tokens.primarySoft,
  primary: tokens.brandPrimary,
};

/**
 * Card — a white surface with a soft lift. The workhorse container for everything: profiles, sessions, stats.
 */
export function Card({
  children,
  tone = 'plain',
  padding = 20,
  radius: radiusProp = radius.lg,
  onPress,
  accessibilityLabel,
  style,
}: CardProps) {
  // Pressed state lives in React state because NativeWind's runtime drops
  // Pressable's function-form style prop (nativewind/nativewind#1105).
  const [pressed, setPressed] = useState(false);
  const base: ViewStyle = { borderRadius: radiusProp, padding, backgroundColor: TONES[tone] };

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={[
          base,
          cardShadow,
          { transform: [{ scale: pressed ? 0.98 : 1 }, { translateY: pressed ? 3 : 0 }] },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[base, cardShadow, style]}>{children}</View>;
}
