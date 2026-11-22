import { Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { tokens } from '@/lib/tokens';

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
  style?: ViewStyle;
}

/**
 * BrushTimer — the 2-minute brushing countdown. A teal progress ring around a
 * white dial with Baloo 2 numerals, readable on the session ground or the mirror. Purely presentational: pass the
 * remaining seconds; drive it from the session state machine.
 */
export function BrushTimer({ remaining = 120, total = 120, size = 240, style }: BrushTimerProps) {
  const stroke = 14;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, 1 - remaining / total));
  // Round caps reach half a stroke past each end of a dash. Shorten the dash by one
  // stroke and start it half a stroke late, so the painted arc runs exactly from
  // 12 o'clock to the elapsed share — the ring and the digits agree.
  const arc = Math.max(0, pct * c - stroke);
  const half = size / 2;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={half} cy={half} r={r + 8.5} fill={tokens.surfaceCard} />
        <Circle cx={half} cy={half} r={r} fill="none" stroke={tokens.sessionTrack} strokeWidth={stroke} />
        {/* The first moments show a dot one stroke wide, then the arc grows from it. */}
        {pct > 0 ? (
          <Circle
            cx={half}
            cy={half}
            r={r}
            fill="none"
            stroke={tokens.brandPrimary}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={[arc, c]}
            strokeDashoffset={-stroke / 2}
          />
        ) : null}
      </Svg>
      <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Text
          className="font-numeric"
          style={{
            fontSize: size * 0.26,
            color: tokens.textPrimary,
            lineHeight: size * 0.28,
            letterSpacing: -1,
            transform: [{ translateY: size * DIGIT_NUDGE }],
          }}
        >
          {formatBrushTime(remaining)}
        </Text>
      </View>
    </View>
  );
}
