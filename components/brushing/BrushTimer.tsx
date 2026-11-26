import { Text, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useReduceTransparency } from '@/hooks/useReduceTransparency';
import { colors, radius } from '@/lib/tokens';

// Baloo 2's tall ascent (room for Devanagari) puts its digits above the middle of a
// tight line box. Measured on the iOS simulator: 0.07 × size pulls them to the
// dial's centre. Re-measure if the font, fontSize or lineHeight below change.
const DIGIT_NUDGE = 0.07;

export function formatBrushTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = String(Math.floor(seconds % 60)).padStart(2, '0');
  return `${minutes}:${remainder}`;
}

interface BrushTimerProps {
  remaining?: number;
  total?: number;
  size?: number;
  translucent?: boolean;
  style?: ViewStyle;
}

/**
 * BrushTimer — the 2-minute brushing countdown. A teal progress ring around a
 * white dial with Baloo 2 numerals, readable on the session ground or the mirror. Purely presentational: pass the
 * remaining seconds; drive it from the session state machine.
 */
export function BrushTimer({ remaining = 120, total = 120, size = 240, translucent = false, style }: BrushTimerProps) {
  const reduceTransparency = useReduceTransparency();
  const { fontScale } = useWindowDimensions();
  const timeBelowDial = fontScale > 1.25;
  const dial = translucent && !reduceTransparency ? colors.sessionPill : colors.glassSessionSolid;
  const stroke = 14;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, 1 - remaining / total));
  // Round caps reach half a stroke past each end of a dash. Shorten the dash by one
  // stroke and start it half a stroke late, so the painted arc runs exactly from
  // 12 o'clock to the elapsed share — the ring and the digits agree.
  const arc = Math.max(0, pct * c - stroke);
  const half = size / 2;

  const time = formatBrushTime(remaining);
  const digits = (
    <Text className="font-numeric"
      style={{
        fontSize: size * 0.26,
        color: colors.ink,
        lineHeight: timeBelowDial ? undefined : size * 0.28,
        letterSpacing: -1,
        transform: [{ translateY: timeBelowDial ? 0 : size * DIGIT_NUDGE }],
        textAlign: 'center',
      }}>
      {time}
    </Text>
  );
  return (
    <View style={[{ alignItems: 'center', rowGap: 8 }, style]}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={half} cy={half} r={r + 11} fill={dial} />
          <Circle cx={half} cy={half} r={r} fill="none" stroke={colors.primaryPress} strokeWidth={stroke + 4} />
          <Circle cx={half} cy={half} r={r} fill="none" stroke={colors.sessionTrack} strokeWidth={stroke} />
          {/* The first moments show a dot one stroke wide, then the arc grows from it. */}
          {pct > 0 ? (
            <Circle
              cx={half}
              cy={half}
              r={r}
              fill="none"
              stroke={colors.primaryPress}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={[arc, c]}
              strokeDashoffset={-stroke / 2}
            />
          ) : null}
        </Svg>
        {timeBelowDial ? null : (
          <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>{digits}</View>
        )}
      </View>
      {timeBelowDial ? (
        <View style={{ maxWidth: '100%', paddingHorizontal: 14, borderRadius: radius.xl, backgroundColor: dial }}>{digits}</View>
      ) : null}
    </View>
  );
}
