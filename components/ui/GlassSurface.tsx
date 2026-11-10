import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, View, type StyleProp, type ViewStyle } from 'react-native';

import { tokens } from '@/lib/tokens';

/** Liquid Glass needs iOS 26+ and the user not asking for less transparency. */
function useGlass(): boolean {
  const [reduceTransparency, setReduceTransparency] = useState(true);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then((v) => alive && setReduceTransparency(v));
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return !reduceTransparency && isLiquidGlassAvailable();
}

// [glass tint, solid fallback when glass is unavailable or Reduce Transparency is on]
const GLASS = {
  chrome: [tokens.glassChrome, tokens.glassChromeSolid],
  session: [tokens.glassSession, tokens.glassSessionSolid],
} as const;

interface GlassSurfaceProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Parent screens (default) or the brushing session. */
  ground?: keyof typeof GLASS;
  /** Glass reacts to touch (buttons, pills). */
  interactive?: boolean;
  /** Colored chrome (e.g. an active button): replaces the ground tint and the solid fallback. */
  tint?: string;
}

/**
 * The ONLY place that uses expo-glass-effect. For floating chrome only — the
 * profile pill, Overview's corner buttons, sheets — never content cards.
 * Falls back to a solid token surface below iOS 26 or with Reduce Transparency.
 * The solid fallback keeps the chrome looking like
 * Beavo with or without glass.
 */
export function GlassSurface({ children, style, ground = 'chrome', interactive = false, tint }: GlassSurfaceProps) {
  const glass = useGlass();
  const [glassTint, solid] = GLASS[ground];
  if (!glass) return <View style={[{ backgroundColor: tint ?? solid }, style]}>{children}</View>;
  return (
    <GlassView glassEffectStyle="regular" isInteractive={interactive} tintColor={tint ?? glassTint} colorScheme="light" style={[{ overflow: 'hidden' }, style]}>
      {children}
    </GlassView>
  );
}
