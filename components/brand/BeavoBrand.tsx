// Beavo brand marks as react-native-svg components. Mark and Sparky come from assets/brand/*.svg (Zing-era design export) — never redraw; regenerate. The wordmark is interim text until the new design system syncs.
import Svg, { Circle, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
import { View } from 'react-native';

type LogoProps = SvgProps & { width?: number; color?: string };

/** The company logo — tooth with a lightning bolt (Zing-era art, kept until the new design system syncs). */
export function BeavoMark({ width = 104, ...rest }: LogoProps) {
  return (
    <Svg viewBox="8 2 104 118" width={width} height={(width * 118.00) / 104.00} accessibilityRole="image" accessibilityLabel="Beavo" {...rest}>
      <Path transform="translate(4 5)" d="M55 9C31 9 17 24 17 48c0 24 6 43 17 58 5 7 16 6 19-3l4-13c1-3 5-3 6 0l4 13c3 9 14 10 19 3 11-15 17-34 17-58 0-24-14-39-38-39Z" fill="#14142B" stroke="#14142B" strokeWidth="5" strokeLinejoin="round" />
      <Path d="M55 9C31 9 17 24 17 48c0 24 6 43 17 58 5 7 16 6 19-3l4-13c1-3 5-3 6 0l4 13c3 9 14 10 19 3 11-15 17-34 17-58 0-24-14-39-38-39Z" fill="#FFFFFF" stroke="#14142B" strokeWidth="5" strokeLinejoin="round" />
      <Path d="M69.3 20.9 L48.3 54.9 H59.3 L53.3 78.9 L74.3 44.9 H63.3 Z" fill="#FFD23F" stroke="#14142B" strokeWidth="4" strokeLinejoin="round" />
    </Svg>
  );
}

/** One-color logo; pass `color` to tint. */
export function BeavoMarkMono({ width = 96, color = '#14142B', ...rest }: LogoProps) {
  return (
    <Svg viewBox="12 4 96 112" width={width} height={(width * 112.00) / 96.00} accessibilityRole="image" accessibilityLabel="Beavo" {...rest}>
      <Path d="M55 9C31 9 17 24 17 48c0 24 6 43 17 58 5 7 16 6 19-3l4-13c1-3 5-3 6 0l4 13c3 9 14 10 19 3 11-15 17-34 17-58 0-24-14-39-38-39Z M69.3 20.9 L48.3 54.9 H59.3 L53.3 78.9 L74.3 44.9 H63.3 Z" fill={color} fillRule="evenodd" />
    </Svg>
  );
}

/** Interim BEAVO wordmark set in Fredoka Bold (ink offset + ink outline + fill) until the new brand art lands. */
export function BeavoWordmark({ width = 240, color = '#2D5BFF', ...rest }: LogoProps) {
  const word = { x: 120, y: 64, textAnchor: 'middle', fontFamily: 'Fredoka-Bold', fontSize: 64 } as const;
  return (
    <Svg viewBox="0 0 240 82" width={width} height={(width * 82) / 240} accessibilityRole="image" accessibilityLabel="Beavo" {...rest}>
      <SvgText {...word} x={word.x + 4} y={word.y + 5} fill="#14142B" stroke="#14142B" strokeWidth={6} strokeLinejoin="round">BEAVO</SvgText>
      <SvgText {...word} fill="#14142B" stroke="#14142B" strokeWidth={6} strokeLinejoin="round">BEAVO</SvgText>
      <SvgText {...word} fill={color}>BEAVO</SvgText>
    </Svg>
  );
}

/** Sunny wordmark for cobalt or ink grounds. */
export function BeavoWordmarkSunny(props: LogoProps) {
  return <BeavoWordmark color="#FFD23F" {...props} />;
}

/** Sparky, the foam-bubble mascot. */
export function Sparky({ width = 120, ...rest }: LogoProps) {
  return (
    <Svg viewBox="0 0 120 120" width={width} height={(width * 120.00) / 120.00} accessibilityRole="image" accessibilityLabel="Sparky" {...rest}>
      <Circle cx="30" cy="26" r="12" fill="#FFFFFF" stroke="#14142B" strokeWidth="4" />
      <Circle cx="92" cy="22" r="8" fill="#FFFFFF" stroke="#14142B" strokeWidth="4" />
      <Circle cx="60" cy="66" r="44" fill="#FFFFFF" stroke="#14142B" strokeWidth="5" />
      <Ellipse cx="46" cy="60" rx="6" ry="8" fill="#14142B" />
      <Ellipse cx="74" cy="60" rx="6" ry="8" fill="#14142B" />
      <Circle cx="48" cy="57" r="2.2" fill="#FFFFFF" />
      <Circle cx="76" cy="57" r="2.2" fill="#FFFFFF" />
      <Circle cx="36" cy="77" r="6" fill="#FF6FB5" />
      <Circle cx="84" cy="77" r="6" fill="#FF6FB5" />
      <Path d="M48 78 Q60 90 72 78" fill="none" stroke="#14142B" strokeWidth="5" strokeLinecap="round" />
      <Path transform="translate(104 48)" d="M0 -12 C2 -3 3 -2 12 0 C3 2 2 3 0 12 C-2 3 -3 2 -12 0 C-3 -2 -2 -3 0 -12Z" fill="#FFD23F" stroke="#14142B" strokeWidth="3" strokeLinejoin="round" />
    </Svg>
  );
}

/** Sparky holding a toothbrush — brushing and coaching. */
export function SparkyBrushing({ width = 170, ...rest }: LogoProps) {
  return (
    <Svg viewBox="0 0 170 140" width={width} height={(width * 140.00) / 170.00} accessibilityRole="image" accessibilityLabel="Sparky" {...rest}>
      <Path d="M44 96 L30 110" fill="none" stroke="#14142B" strokeWidth="14" strokeLinecap="round" />
      <Path d="M44 96 L30 110" fill="none" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
      <Path d="M118 92 L136 74" fill="none" stroke="#14142B" strokeWidth="14" strokeLinecap="round" />
      <Path d="M118 92 L136 74" fill="none" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
      <Circle cx="48" cy="38" r="12" fill="#FFFFFF" stroke="#14142B" strokeWidth="4" />
      <Circle cx="80" cy="80" r="44" fill="#FFFFFF" stroke="#14142B" strokeWidth="5" />
      <Ellipse cx="66" cy="74" rx="6" ry="8" fill="#14142B" />
      <Ellipse cx="94" cy="74" rx="6" ry="8" fill="#14142B" />
      <Circle cx="68" cy="71" r="2.2" fill="#FFFFFF" />
      <Circle cx="96" cy="71" r="2.2" fill="#FFFFFF" />
      <Circle cx="56" cy="91" r="6" fill="#FF6FB5" />
      <Circle cx="104" cy="91" r="6" fill="#FF6FB5" />
      <Path d="M68 92 Q80 104 92 92" fill="none" stroke="#14142B" strokeWidth="5" strokeLinecap="round" />
      <G transform="translate(138 66) rotate(-35)">
        <Rect x="-6" y="-40" width="12" height="52" rx="6" fill="#2D5BFF" stroke="#14142B" strokeWidth="4" />
        <Rect x="-9" y="-58" width="18" height="20" rx="5" fill="#FFD23F" stroke="#14142B" strokeWidth="4" />
      </G>
    </Svg>
  );
}

/** Sparky cheering — rewards and streaks. */
export function SparkyCheer({ width = 170, ...rest }: LogoProps) {
  return (
    <Svg viewBox="0 0 170 140" width={width} height={(width * 140.00) / 170.00} accessibilityRole="image" accessibilityLabel="Sparky" {...rest}>
      <Path d="M46 64 L26 34" fill="none" stroke="#14142B" strokeWidth="14" strokeLinecap="round" />
      <Path d="M46 64 L26 34" fill="none" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
      <Path d="M114 64 L134 34" fill="none" stroke="#14142B" strokeWidth="14" strokeLinecap="round" />
      <Path d="M114 64 L134 34" fill="none" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
      <Circle cx="80" cy="80" r="44" fill="#FFFFFF" stroke="#14142B" strokeWidth="5" />
      <Path d="M59 76 Q66 66 73 76" fill="none" stroke="#14142B" strokeWidth="5" strokeLinecap="round" />
      <Path d="M87 76 Q94 66 101 76" fill="none" stroke="#14142B" strokeWidth="5" strokeLinecap="round" />
      <Circle cx="56" cy="91" r="6" fill="#FF6FB5" />
      <Circle cx="104" cy="91" r="6" fill="#FF6FB5" />
      <Path d="M67 90 Q80 112 93 90 Z" fill="#14142B" stroke="#14142B" strokeWidth="3" strokeLinejoin="round" />
      <Path d="M73 101 Q80 106 87 101" fill="none" stroke="#FF6FB5" strokeWidth="4" strokeLinecap="round" />
      <Path transform="translate(24 22) scale(1)" d="M0 -12 C2 -3 3 -2 12 0 C3 2 2 3 0 12 C-2 3 -3 2 -12 0 C-3 -2 -2 -3 0 -12Z" fill="#FFD23F" stroke="#14142B" strokeWidth="3.00" strokeLinejoin="round" />
      <Path transform="translate(144 20) scale(0.8)" d="M0 -12 C2 -3 3 -2 12 0 C3 2 2 3 0 12 C-2 3 -3 2 -12 0 C-3 -2 -2 -3 0 -12Z" fill="#FF6FB5" stroke="#14142B" strokeWidth="3.75" strokeLinejoin="round" />
      <Circle cx="80" cy="16" r="7" fill="#FFFFFF" stroke="#14142B" strokeWidth="4" />
    </Svg>
  );
}

/** Sparky waving — onboarding and empty states. */
export function SparkyWave({ width = 170, ...rest }: LogoProps) {
  return (
    <Svg viewBox="0 0 170 140" width={width} height={(width * 140.00) / 170.00} accessibilityRole="image" accessibilityLabel="Sparky" {...rest}>
      <Path d="M44 96 L30 110" fill="none" stroke="#14142B" strokeWidth="14" strokeLinecap="round" />
      <Path d="M44 96 L30 110" fill="none" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
      <Path d="M118 72 L138 42" fill="none" stroke="#14142B" strokeWidth="14" strokeLinecap="round" />
      <Path d="M118 72 L138 42" fill="none" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
      <Path d="M146 30 Q154 40 150 52" fill="none" stroke="#14142B" strokeWidth="4" strokeLinecap="round" />
      <Path d="M154 22 Q166 38 160 56" fill="none" stroke="#14142B" strokeWidth="4" strokeLinecap="round" />
      <Circle cx="46" cy="40" r="12" fill="#FFFFFF" stroke="#14142B" strokeWidth="4" />
      <Circle cx="80" cy="80" r="44" fill="#FFFFFF" stroke="#14142B" strokeWidth="5" />
      <Ellipse cx="66" cy="74" rx="6" ry="8" fill="#14142B" />
      <Ellipse cx="94" cy="74" rx="6" ry="8" fill="#14142B" />
      <Circle cx="68" cy="71" r="2.2" fill="#FFFFFF" />
      <Circle cx="96" cy="71" r="2.2" fill="#FFFFFF" />
      <Circle cx="56" cy="91" r="6" fill="#FF6FB5" />
      <Circle cx="104" cy="91" r="6" fill="#FF6FB5" />
      <Path d="M68 92 Q80 104 92 92" fill="none" stroke="#14142B" strokeWidth="5" strokeLinecap="round" />
    </Svg>
  );
}

/** Horizontal lockup: the tooth logo beside the BEAVO wordmark. */
export function BeavoLockup({ height = 48 }: { height?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: height * 0.2 }}>
      <BeavoMark width={height * 0.88} />
      <BeavoWordmark width={height * 2.6} />
    </View>
  );
}
