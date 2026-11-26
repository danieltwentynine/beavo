import type { ToothEvent } from '@/types';

/**
 * Primary dentition (kids only): FDI quadrants 5 (upper right), 6 (upper left),
 * 7 (lower left), 8 (lower right) — the child's own right/left — with positions
 * 1 (central incisor) to 5 (second molar). Pure: no RN or firebase imports, so
 * `node --test` runs it.
 */

export type Arch = 'upper' | 'lower';
export type Side = 'right' | 'left';
export type ToothKind = 'centralIncisor' | 'lateralIncisor' | 'canine' | 'firstMolar' | 'secondMolar';

const KINDS: readonly ToothKind[] = ['centralIncisor', 'lateralIncisor', 'canine', 'firstMolar', 'secondMolar'];

export const PRIMARY_TEETH: readonly number[] = [5, 6, 7, 8].flatMap((q) => [1, 2, 3, 4, 5].map((p) => q * 10 + p));

export const isPrimaryTooth = (fdi: number): boolean => PRIMARY_TEETH.includes(fdi);

export interface ToothInfo {
  fdi: number;
  arch: Arch;
  /** The child's side (not the viewer's). */
  side: Side;
  kind: ToothKind;
}

export function toothInfo(fdi: number): ToothInfo {
  const quadrant = Math.floor(fdi / 10);
  return {
    fdi,
    arch: quadrant === 5 || quadrant === 6 ? 'upper' : 'lower',
    side: quadrant === 5 || quadrant === 8 ? 'right' : 'left',
    kind: KINDS[(fdi % 10) - 1],
  };
}

/**
 * Who is looking at the chart.
 * - 'dentist': facing the child, like a dentist, or a parent looking into the
 *   child's mouth. The child's RIGHT side is on the viewer's LEFT. This is the
 *   standard convention on dental charts and in dentists' reports, so events
 *   parents copy from a report land on the same tooth.
 * - 'patient': as the child sees their own mouth (not mirrored); the child's
 *   right is on the viewer's right.
 */
export type ViewPerspective = 'dentist' | 'patient';

/** Teeth of one arch in viewer left → right order. */
export function archOrder(arch: Arch, perspective: ViewPerspective): number[] {
  const [rightQ, leftQ] = arch === 'upper' ? [5, 6] : [8, 7];
  const childRight = [5, 4, 3, 2, 1].map((p) => rightQ * 10 + p); // molar → midline
  const childLeft = [1, 2, 3, 4, 5].map((p) => leftQ * 10 + p); // midline → molar
  return perspective === 'dentist' ? [...childRight, ...childLeft] : [...childLeft.reverse(), ...childRight.reverse()];
}

/** Which side of the chart (viewer's) shows the child's right side. */
export const childRightOnViewerLeft = (perspective: ViewPerspective): boolean => perspective === 'dentist';

// ---- Geometry (viewBox units) ----

export const ARCH_VIEWBOX = { width: 320, height: 340 } as const;

const CENTER_X = 160;
/** Center label sits here; each arc's ellipse is pulled toward it by ARCH_OVERLAP so the two read as one oval. */
export const ARCH_CENTER_Y = 170;
const ARCH_OVERLAP = 15;
const RADIUS_X = 125;
const RADIUS_Y = 135;
/** Each arc stops this far (degrees) short of the horizontal, leaving the sides open like a mouth. */
const ARC_INSET_DEG = 20;
const GAP = 2.5;

/** Width along the arch × depth across it, per tooth kind. Upper primary incisors are wider than lower. */
const SIZE: Record<Arch, Record<ToothKind, { w: number; d: number }>> = {
  upper: {
    centralIncisor: { w: 28, d: 26 },
    lateralIncisor: { w: 24, d: 25 },
    canine: { w: 26, d: 28 },
    firstMolar: { w: 32, d: 32 },
    secondMolar: { w: 36, d: 34 },
  },
  lower: {
    centralIncisor: { w: 20, d: 24 },
    lateralIncisor: { w: 22, d: 24 },
    canine: { w: 24, d: 27 },
    firstMolar: { w: 32, d: 32 },
    secondMolar: { w: 38, d: 34 },
  },
};

export interface ToothPlacement extends ToothInfo {
  /** Center, viewBox units. */
  x: number;
  y: number;
  /** Degrees; local x follows the arch tangent, local −y points out of the mouth. */
  rotation: number;
  width: number;
  depth: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Teeth along two elliptical arcs (upper: top half, lower: bottom half), each
 * spaced by its own width and rotated tangent to the arc.
 */
export function layoutArch(perspective: ViewPerspective): ToothPlacement[] {
  const placeArch = (arch: Arch): ToothPlacement[] => {
    // Viewer left → right: upper runs θ 180+inset → 360−inset, lower runs θ 180−inset → inset.
    const [from, to] = arch === 'upper' ? [180 + ARC_INSET_DEG, 360 - ARC_INSET_DEG] : [180 - ARC_INSET_DEG, ARC_INSET_DEG];
    const cy = arch === 'upper' ? ARCH_CENTER_Y + ARCH_OVERLAP : ARCH_CENTER_Y - ARCH_OVERLAP;
    const point = (deg: number) => ({ x: CENTER_X + RADIUS_X * Math.cos(rad(deg)), y: cy + RADIUS_Y * Math.sin(rad(deg)) });

    // Arc-length table so teeth are spaced by width, not by angle.
    const steps = 600;
    const table: { deg: number; len: number }[] = [{ deg: from, len: 0 }];
    for (let i = 1; i <= steps; i++) {
      const deg = from + ((to - from) * i) / steps;
      const a = point(table[i - 1].deg);
      const b = point(deg);
      table.push({ deg, len: table[i - 1].len + Math.hypot(b.x - a.x, b.y - a.y) });
    }
    const total = table[steps].len;
    const degAt = (len: number) => table.find((t) => t.len >= len)?.deg ?? to;

    const teeth = archOrder(arch, perspective).map(toothInfo);
    const sizes = teeth.map((t) => SIZE[arch][t.kind]);
    const used = sizes.reduce((sum, s) => sum + s.w, 0) + GAP * (teeth.length - 1);
    let cursor = (total - used) / 2;

    return teeth.map((t, i) => {
      const { w, d } = sizes[i];
      const deg = degAt(cursor + w / 2);
      cursor += w + GAP;
      const { x, y } = point(deg);
      // Tangent for increasing θ; for the lower arch that points viewer-left,
      // which turns local −y downward — out of the mouth, as wanted.
      const rotation = (Math.atan2(RADIUS_Y * Math.cos(rad(deg)), -RADIUS_X * Math.sin(rad(deg))) * 180) / Math.PI;
      return { ...t, x, y, rotation, width: w, depth: d };
    });
  };
  return [...placeArch('upper'), ...placeArch('lower')];
}

/**
 * Tooth outline in local coordinates (centered at 0,0; −y points out of the
 * mouth): incisors narrow and rounded, canines pointed outward, primary molars
 * wide and squarish.
 */
export function toothPath(kind: ToothKind, w: number, d: number): string {
  const hw = w / 2;
  const hd = d / 2;
  if (kind === 'canine') {
    return [
      `M ${-hw} ${hd * 0.35}`,
      `Q ${-hw} ${-hd * 0.35} 0 ${-hd}`,
      `Q ${hw} ${-hd * 0.35} ${hw} ${hd * 0.35}`,
      `Q ${hw} ${hd} 0 ${hd}`,
      `Q ${-hw} ${hd} ${-hw} ${hd * 0.35}`,
      'Z',
    ].join(' ');
  }
  // Rounded rectangle; incisors get near-pill corners, molars tight ones.
  const r = kind === 'firstMolar' || kind === 'secondMolar' ? Math.min(hw, hd) * 0.45 : Math.min(hw, hd) * 0.9;
  return [
    `M ${-hw + r} ${-hd}`,
    `H ${hw - r}`,
    `Q ${hw} ${-hd} ${hw} ${-hd + r}`,
    `V ${hd - r}`,
    `Q ${hw} ${hd} ${hw - r} ${hd}`,
    `H ${-hw + r}`,
    `Q ${-hw} ${hd} ${-hw} ${hd - r}`,
    `V ${-hd + r}`,
    `Q ${-hw} ${-hd} ${-hw + r} ${-hd}`,
    'Z',
  ].join(' ');
}

/** Molar cusp groove (a soft "+"), local coordinates; null for other kinds. */
export function molarGroovePath(kind: ToothKind, w: number, d: number): string | null {
  if (kind !== 'firstMolar' && kind !== 'secondMolar') return null;
  return `M ${-w * 0.22} 0 H ${w * 0.22} M 0 ${-d * 0.22} V ${d * 0.22}`;
}

/**
 * The tooth whose center is nearest (x, y), if within `maxDistance`. Touches
 * resolve to the nearest tooth, so every tooth owns at least a circle of
 * `maxDistance` minus the overlap with its neighbours — no tooth hides another.
 */
export function nearestTooth(layout: readonly ToothPlacement[], x: number, y: number, maxDistance: number): number | null {
  let best: number | null = null;
  let bestDistance = maxDistance;
  for (const t of layout) {
    const d = Math.hypot(t.x - x, t.y - y);
    if (d <= bestDistance) {
      best = t.fdi;
      bestDistance = d;
    }
  }
  return best;
}

// ---- Events ----

export type ToothStatus = 'symptom' | 'treatment' | 'both';

/** Per tooth: whether it has symptom and/or treatment events. */
export function statusByTooth(events: readonly Pick<ToothEvent, 'fdi' | 'type'>[]): Record<number, ToothStatus> {
  const status: Record<number, ToothStatus> = {};
  for (const e of events) {
    const current = status[e.fdi];
    status[e.fdi] = !current || current === e.type ? e.type : 'both';
  }
  return status;
}

/** Symptom and treatment counts for events dated in `year`. */
export function countForYear(events: readonly Pick<ToothEvent, 'type' | 'date'>[], year: number): { symptoms: number; treatments: number } {
  const prefix = `${year}-`;
  let symptoms = 0;
  let treatments = 0;
  for (const e of events) {
    if (!e.date.startsWith(prefix)) continue;
    if (e.type === 'symptom') symptoms++;
    else treatments++;
  }
  return { symptoms, treatments };
}

/** Newest first by date (YYYY-MM-DD sorts as text); same-day order is stable. */
export const newestFirst = <T extends Pick<ToothEvent, 'date'>>(events: readonly T[]): T[] =>
  [...events].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

/** A YYYY-MM-DD that is a real calendar date and not after `today`. */
export function isValidEventDate(date: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) return false;
  const [y, m, d] = date.split('-').map(Number);
  const parsed = new Date(y, m - 1, d);
  return parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === d;
}
