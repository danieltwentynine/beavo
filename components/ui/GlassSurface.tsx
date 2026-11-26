import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useReduceTransparency } from '@/hooks/useReduceTransparency';
import { colors } from '@/lib/tokens';

// [glass tint, solid fallback when glass is unavailable or Reduce Transparency is on]
const GLASS = {
  chrome: [colors.glassChrome, colors.glassChromeSolid],
  session: [colors.glassSession, colors.glassSessionSolid],
} as const;

interface GlassSurfaceProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Parent screens (default) or the brushing session. */
  ground?: keyof typeof GLASS;
  /** Glass reacts to touch (buttons, pills). */
  interactive?: boolean;
  /** Glass tint and, when needed, a separate opaque fill for its solid version. */
  tint?: { glass: string; opaque?: string };
}

/**
 * The ONLY place that uses expo-glass-effect. For floating chrome only — the
 * profile pill, Overview's corner buttons, sheets — never content cards.
 * Falls back to a solid token surface below iOS 26 or with Reduce Transparency.
 * The solid fallback keeps the chrome looking like
 * Beavo with or without glass.
 */
export function GlassSurface({ children, style, ground = 'chrome', interactive = false, tint }: GlassSurfaceProps) {
  const reduceTransparency = useReduceTransparency();
  const glass = !reduceTransparency && isLiquidGlassAvailable();
  const [glassTint, solid] = GLASS[ground];
  if (!glass) return <View style={[{ backgroundColor: tint?.opaque ?? solid }, style]}>{children}</View>;
  const background = tint?.glass ?? glassTint;
  return (
    <GlassView glassEffectStyle="regular" isInteractive={interactive}
      tintColor={ground === 'chrome' ? background : undefined}
      colorScheme="light" style={[{ overflow: 'hidden' }, style]}>
      {/* Cover the native material with a known alpha so content contrast has a measurable floor. */}
      {ground === 'session' ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: background }]} />
      ) : null}
      {children}
    </GlassView>
  );
}
