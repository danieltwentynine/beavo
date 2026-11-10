import { Fragment } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

import type { ToothZone } from '@/types';
import { tokens } from '@/lib/tokens';

export type ZoneState = 'empty' | 'active' | 'done' | 'missed';

/**
 * Zone order around the arch (upper L→R across the top, lower L→R across the
 * bottom). This drives the SVG sector layout, so the order is intentional.
 */
const MOUTH_ZONES: ToothZone[] = [
  'top-back-left', 'top-left', 'top-front', 'top-right', 'top-back-right',
  'bottom-back-left', 'bottom-left', 'bottom-front', 'bottom-right', 'bottom-back-right',
];

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

interface MouthMapProps {
  states?: Partial<Record<ToothZone, ZoneState>>;
  size?: number;
}

/**
 * MouthMap — the signature Beavo component. A stylized dental arch of 10 zones
 * that fill as the child brushes (CLAUDE.md > MouthMap.tsx).
 * empty (sunken) → active (white, thick teal ring, foam bubbles) → done (teal + check).
 * Un-brushed zones end as missed (honey yellow + retry glyph) — never red.
 */
export function MouthMap({ states = {}, size = 220 }: MouthMapProps) {
  const cx = 110, cy = 110, ro = 96, ri = 50;
  const gap = 3;
  const upper = MOUTH_ZONES.slice(0, 5);
  const lower = MOUTH_ZONES.slice(5);

  const buildArc = (zones: ToothZone[], startDeg: number, endDeg: number) => {
    const span = (endDeg - startDeg) / zones.length;
    return zones.map((z, i) => {
      const a0 = startDeg + i * span + gap / 2;
      const a1 = startDeg + (i + 1) * span - gap / 2;
      const st: ZoneState = states[z] ?? 'empty';
      const mid = (a0 + a1) / 2;
      const [lx, ly] = polar(cx, cy, (ri + ro) / 2, mid);
      return { z, a0, a1, st, lx, ly };
    });
  };

  const segments = [...buildArc(upper, 200, 340), ...buildArc(lower, 20, 160)];

  return (
    <Svg width={size} height={size} viewBox="0 0 220 220">
      <Circle cx={cx} cy={cy} r={ri - 8} fill={tokens.primarySoft} />
      {segments.map(({ z, a0, a1, st, lx, ly }) => (
        <Fragment key={z}>
          <Path
            d={sectorPath(cx, cy, ri, ro, a0, a1)}
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
      ))}
    </Svg>
  );
}
