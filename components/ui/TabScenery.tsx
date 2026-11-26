import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { cloud } from '@/components/brushing/riverbankArt';
import { colors } from '@/lib/tokens';

/** Decorative sky that sits behind the status bar, tab heading and first card. */
export function TabScenery() {
  return (
    <Svg width="100%" height={218} viewBox="0 0 390 218" preserveAspectRatio="none"
      pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: 0 }}>
      <Defs>
        <LinearGradient id="tabSky" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset={0} stopColor={colors.sceneSky} />
          <Stop offset={1} stopColor={colors.bg} />
        </LinearGradient>
        <LinearGradient id="tabHillsFade" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset={0.82} stopColor={colors.bg} stopOpacity={0} />
          <Stop offset={1} stopColor={colors.bg} />
        </LinearGradient>
      </Defs>
      <Rect width={390} height={218} fill="url(#tabSky)" />
      <G transform="translate(214 60) scale(0.5)">{cloud}</G>
      <Path d="M0 190 Q70 168 140 184 T280 178 T390 172 V218 H0Z" fill={colors.sceneHillLight} />
      <Path d="M0 206 Q90 188 190 202 T390 196 V218 H0Z" fill={colors.sceneHill} />
      <Rect width={390} height={218} fill="url(#tabHillsFade)" />
    </Svg>
  );
}
