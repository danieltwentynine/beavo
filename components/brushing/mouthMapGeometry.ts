import type { ToothZone } from '../../types/index.ts';

const UPPER_ZONES = [
  'top-back-left', 'top-left', 'top-front', 'top-right', 'top-back-right',
] as const satisfies readonly ToothZone[];

// Increasing SVG angles run from screen right to screen left on the lower arc.
const LOWER_ZONES = [
  'bottom-back-right', 'bottom-right', 'bottom-front', 'bottom-left', 'bottom-back-left',
] as const satisfies readonly ToothZone[];

function archAngles(zones: readonly ToothZone[], start: number, end: number) {
  const span = (end - start) / zones.length;
  const halfGap = 1.5;
  return zones.map((zone, index) => ({
    zone,
    start: start + index * span + halfGap,
    end: start + (index + 1) * span - halfGap,
  }));
}

export function mouthMapZoneAngles() {
  return [...archAngles(UPPER_ZONES, 200, 340), ...archAngles(LOWER_ZONES, 20, 160)];
}
