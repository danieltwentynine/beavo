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

interface GlassSurfaceProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Solid color used when glass is unavailable. */
  fallbackColor?: string;
  /** Glass reacts to touch (buttons, pills). */
  interactive?: boolean;
  /** Colored chrome (e.g. an active button): tints the glass, and is the solid fallback. */
  tint?: string;
}

/**
 * The ONLY place that uses expo-glass-effect. For floating chrome only — the
 * profile pill, Overview's corner buttons, sheets — never content cards.
 * Falls back to a solid token surface below iOS 26 or with Reduce Transparency.
 * Callers keep the Toy box ink outline in `style`, so the chrome looks like
 * Zing with or without glass.
 */
export function GlassSurface({ children, style, fallbackColor = tokens.surfaceCard, interactive = false, tint }: GlassSurfaceProps) {
  const glass = useGlass();
  if (!glass) return <View style={[{ backgroundColor: tint ?? fallbackColor }, style]}>{children}</View>;
  return (
    <GlassView glassEffectStyle="regular" isInteractive={interactive} tintColor={tint} colorScheme="light" style={[{ overflow: 'hidden' }, style]}>
      {children}
    </GlassView>
  );
}
