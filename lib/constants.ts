import type { ToothZone } from '@/types';

export const COUNTDOWN_SECONDS = 3;

// Guide order for the brushing session: each arch ends with the back teeth,
// so stopping early leaves them un-brushed — exactly the "reach your back
// teeth" coaching moment from the design.
export const ALL_TOOTH_ZONES: ToothZone[] = [
  'top-front',
  'top-left',
  'top-right',
  'top-back-left',
  'top-back-right',
  'bottom-front',
  'bottom-left',
  'bottom-right',
  'bottom-back-left',
  'bottom-back-right',
];
