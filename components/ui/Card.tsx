import { useState, type ReactNode } from 'react';
import { Pressable, View, type AccessibilityState, type ViewStyle } from 'react-native';

import { useLiveReduceMotion } from '@/hooks/useLiveReduceMotion';
import { colors, radius, shadow } from '@/lib/tokens';

type CardTone = 'plain' | 'soft' | 'primary';

interface CardProps {
  children: ReactNode;
  tone?: CardTone;
  padding?: number;
  radius?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
  style?: ViewStyle;
}

const TONES: Record<CardTone, string> = {
  plain: colors.surface,
  soft: colors.primarySoft,
  primary: colors.primary,
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
  accessibilityState,
  style,
}: CardProps) {
  // Pressed state lives in React state because NativeWind's runtime drops
  // Pressable's function-form style prop (nativewind/nativewind#1105).
  const [pressed, setPressed] = useState(false);
  const reduceMotion = useLiveReduceMotion();
  const moveOnPress = pressed && !reduceMotion;
  const base: ViewStyle = { borderRadius: radiusProp, padding, backgroundColor: TONES[tone] };

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={[
          base,
          shadow.card,
          {
            opacity: pressed && reduceMotion ? 0.92 : 1,
            transform: [{ scale: moveOnPress ? 0.98 : 1 }, { translateY: moveOnPress ? 3 : 0 }],
          },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[base, shadow.card, style]}>{children}</View>;
}
