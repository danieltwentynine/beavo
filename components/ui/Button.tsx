import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, type ViewStyle } from 'react-native';

import { cardShadow, hairline, motion, pressShadow, radius, tokens } from '@/lib/tokens';

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
  primary: { bg: tokens.brandPrimary, fg: tokens.textOnBrand, lift: 'press' },
  soft: { bg: tokens.primarySoft, fg: tokens.brandPrimary, lift: 'none' },
  outline: { bg: tokens.surfaceCard, fg: tokens.textPrimary, lift: 'card' },
  ghost: { bg: 'transparent', fg: tokens.brandPrimary, lift: 'none' },
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
          height: s.height,
          paddingHorizontal: s.paddingHorizontal,
          borderRadius: radius.pill,
          width: fullWidth ? '100%' : undefined,
          alignSelf: fullWidth ? 'stretch' : undefined,
          backgroundColor: v.bg,
          opacity: isDisabled ? 0.5 : 1,
          transform: [
            { scale: pressed && !isDisabled ? motion.pressScale : 1 },
            { translateY: pressed && !isDisabled ? 2 : 0 },
          ],
        },
        v.lift === 'press' ? pressShadow(pressed || isDisabled) : v.lift === 'card' ? [hairline, cardShadow] : null,
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
            style={{ color: v.fg, fontSize: s.font, lineHeight: s.font * 1.2 }}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
