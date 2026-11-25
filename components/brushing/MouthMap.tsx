import { Fragment } from 'react';
import { View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import type { ToothZone } from '@/types';
import { tokens } from '@/lib/tokens';

import { mouthMapZoneAngles } from './mouthMapGeometry';

export type ZoneState = 'empty' | 'active' | 'done' | 'missed';

// [fill, outline, outline width]. Every state also has its own glyph or fill — never colour alone.
const STATE_STYLE: Record<ZoneState, [string, string, number]> = {
  empty: [tokens.zoneEmpty, tokens.zoneLine, 3],
  active: [tokens.zoneActive, tokens.zoneDone, 5],
  done: [tokens.zoneDone, tokens.zoneDone, 3],
  missed: [tokens.zoneMissed, tokens.warningLine, 3],
};

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function sectorPath(cx: number, cy: number, ri: number, ro: number, a0: number, a1: number): string {
  const [x0o, y0o] = polar(cx, cy, ro, a0);
  const [x1o, y1o] = polar(cx, cy, ro, a1);
  const [x1i, y1i] = polar(cx, cy, ri, a1);
  const [x0i, y0i] = polar(cx, cy, ri, a0);
  return `M ${x0o} ${y0o} A ${ro} ${ro} 0 0 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${ri} ${ri} 0 0 0 ${x0i} ${y0i} Z`;
}

const cx = 110, cy = 110, ro = 96, ri = 50;
const segments = mouthMapZoneAngles().map(({ zone, start, end }) => {
  const [lx, ly] = polar(cx, cy, (ri + ro) / 2, (start + end) / 2);
  return { zone, path: sectorPath(cx, cy, ri, ro, start, end), lx, ly };
});

const bubbleSettle = new Keyframe({
  from: { opacity: 1, transform: [{ translateY: 4 }, { scale: 0.7 }] },
  60: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: Easing.out(Easing.quad) },
  to: { opacity: 0, transform: [{ translateY: -2 }, { scale: 0.9 }] },
}).duration(240);

interface MouthMapProps {
  states?: Partial<Record<ToothZone, ZoneState>>;
  size?: number;
  foamZone?: ToothZone;
}

/**
 * MouthMap — the signature Beavo component. A stylized dental arch of 10 zones
 * that fill as the child brushes (CLAUDE.md > MouthMap.tsx).
 * empty (sunken) → active (white, thick teal ring, foam bubbles) → done (teal + check).
 * Un-brushed zones end as missed (honey yellow + retry glyph) — never red.
 */
export function MouthMap({ states = {}, size = 220, foamZone }: MouthMapProps) {
  const foam = segments.find(({ zone }) => zone === foamZone);

  const scale = size / 220;
  return (
    <View>
      <MouthMapSvg states={states} size={size} />
      {foam ? <Animated.View
        key={foam.zone}
        entering={bubbleSettle}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', left: (foam.lx - 8) * scale, top: (foam.ly - 13) * scale }}
      >
        <Svg width={18 * scale} height={14 * scale} viewBox="0 0 18 14">
          <Circle cx={4} cy={9} r={2.4} fill={tokens.primarySoft} />
          <Circle cx={14} cy={4} r={3} fill={tokens.textOnBrand} />
        </Svg>
      </Animated.View> : null}
    </View>
  );
}

function MouthMapSvg({ states, size }: Required<Pick<MouthMapProps, 'states' | 'size'>>) {
  return (
    <Svg width={size} height={size} viewBox="0 0 220 220">
      <Circle cx={cx} cy={cy} r={ri - 8} fill={tokens.primarySoft} />
      {segments.map(({ zone, path, lx, ly }) => {
        const st = states[zone] ?? 'empty';
        return (
          <Fragment key={zone}>
            <Path
              d={path}
              fill={STATE_STYLE[st][0]}
              stroke={STATE_STYLE[st][1]}
              strokeWidth={STATE_STYLE[st][2]}
              strokeLinejoin="round"
            />
            {st === 'active' ? (
              <>
                <Circle cx={lx - 5} cy={ly + 1} r={2.7} fill={tokens.zoneDone} />
                <Circle cx={lx + 2} cy={ly - 4} r={3.7} fill={tokens.zoneDone} />
                <Circle cx={lx + 5.5} cy={ly + 3} r={2} fill={tokens.zoneDone} />
              </>
            ) : null}
            {st === 'done' ? (
              <Path d={`M ${lx - 6} ${ly} l4 4 l8 -9`} fill="none" stroke={tokens.textOnBrand} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            ) : null}
            {st === 'missed' ? (
              <Path d={`M ${lx + 5} ${ly - 2} a5.5 5.5 0 1 0 0.5 4 M ${lx + 6} ${ly - 7} v5 h-5`} fill="none" stroke={tokens.onWarning} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            ) : null}
          </Fragment>
        );
      })}
    </Svg>
  );
}
