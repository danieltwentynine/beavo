import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, type ViewStyle } from 'react-native';

import { useLiveReduceMotion } from '@/hooks/useLiveReduceMotion';
import { colors, hairline, motion, pressShadow, radius, shadow } from '@/lib/tokens';

type ButtonVariant = 'primary' | 'soft' | 'ghost' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
}

// Controls are 56px; sm still clears the 48px touch-target minimum.
const SIZES: Record<ButtonSize, { height: number; paddingHorizontal: number; font: number }> = {
  sm: { height: 48, paddingHorizontal: 20, font: 16 },
  md: { height: 56, paddingHorizontal: 28, font: 20 },
  lg: { height: 64, paddingHorizontal: 32, font: 22 },
};

// White text only on primary. Primary sits on a pressable ledge; outline floats like a card.
const VARIANTS: Record<ButtonVariant, { bg: string; fg: string; lift: 'press' | 'card' | 'none' }> = {
  primary: { bg: colors.primary, fg: colors.onPrimary, lift: 'press' },
  soft: { bg: colors.primarySoft, fg: colors.primary, lift: 'none' },
  outline: { bg: colors.surface, fg: colors.ink, lift: 'card' },
  ghost: { bg: 'transparent', fg: colors.primary, lift: 'none' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  fullWidth = true,
  loading = false,
  disabled = false,
  icon,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  // Pressed state lives in React state because NativeWind's runtime drops
  // Pressable's function-form style prop (nativewind/nativewind#1105) —
  // style={({ pressed }) => ...} renders completely unstyled here.
  const [pressed, setPressed] = useState(false);
  const reduceMotion = useLiveReduceMotion();
  const pressActive = pressed && !isDisabled;
  const moveOnPress = pressActive && !reduceMotion;
  const s = SIZES[size];
  const v = VARIANTS[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={isDisabled}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          columnGap: 10,
          minHeight: s.height,
          paddingVertical: 8,
          paddingHorizontal: s.paddingHorizontal,
          borderRadius: radius.pill,
          width: fullWidth ? '100%' : undefined,
          alignSelf: fullWidth ? 'stretch' : undefined,
          backgroundColor: v.bg,
          opacity: isDisabled ? 0.5 : pressActive && reduceMotion ? 0.92 : 1,
          transform: [
            { scale: moveOnPress ? motion.pressScale : 1 },
            { translateY: moveOnPress ? 2 : 0 },
          ],
        },
        v.lift === 'press' ? pressShadow(moveOnPress || isDisabled) : v.lift === 'card' ? [hairline, shadow.card] : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon}
          <Text
            className="font-display"
            style={{ color: v.fg, flexShrink: 1, textAlign: 'center', fontSize: s.font, lineHeight: s.font * 1.2 }}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
