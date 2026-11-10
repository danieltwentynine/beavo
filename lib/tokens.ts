/**
 * Beavo design tokens — "Riacho", calm like a picture book. Values mirror
 * design/tokens.json (copied from the Beavo design system); tailwind.preset.js
 * carries the same values as NativeWind classes. Use these where classes can't
 * reach: SVG fills, shadows, inline styles.
 */
export const tokens = {
  textPrimary: '#22302E',
  textSecondary: '#58655F',
  textOnBrand: '#FFFFFF',
  textLink: '#0A746E',

  surfacePage: '#FFF7EA',
  surfaceCard: '#FFFFFF',
  primarySoft: '#D3EEEA',
  line: '#EADFCB',

  brandPrimary: '#0A746E',
  brandPrimaryPress: '#075A55',
  secondary: '#8FCB63',
  onSecondary: '#1C2B1A',

  /** Stickers, badges and streaks only. */
  reward: '#B83A75',
  onReward: '#FFFFFF',
  /** Warm honey yellow, never red. Always paired with the retry glyph. */
  warning: '#F6C447',
  onWarning: '#3A2A00',
  warningLine: '#9C7000',
  /** Parent screens only; never in kid mode. */
  danger: '#B3261E',

  // Brushing session
  sessionBg: '#E4F1F7',
  sessionTrack: '#C9DCE5',
  zoneEmpty: '#C9DCE5',
  zoneLine: '#6F8A96',
  zoneActive: '#FFFFFF',
  zoneDone: '#0A746E',
  zoneMissed: '#F6C447',

  // Liquid Glass tints for floating chrome, and their solid fallbacks
  glassChrome: 'rgba(255,255,255,0.62)',
  glassSession: 'rgba(255,255,255,0.55)',
  glassChromeSolid: '#FBF7F0',
  glassSessionSolid: '#FFFFFF',
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
} as const;

/** Static weights: pick the family, never fontWeight. Loaded in app/_layout.tsx. */
export const font = {
  display: 'Baloo2-Bold',
  numeric: 'Baloo2-ExtraBold',
  body: 'Nunito-Regular',
  bodySemi: 'Nunito-SemiBold',
} as const;

/** Hairline for white-on-white edges (inputs, unchecked boxes). Decorative. */
export const hairline = { borderWidth: 1, borderColor: tokens.line } as const;

/** Soft lift under cards and the CoachCard. */
/** Edge of a control that must be seen (checkbox, input, empty dot): 3:1 on white and cream. */
export const controlBorder = { borderWidth: 2, borderColor: tokens.zoneLine } as const;

export const cardShadow = { boxShadow: '0 6px 18px rgba(34,48,46,0.10)' } as const;

/** Resting depth under a primary button; collapses on press. Keep the key, change the value (Fabric). */
export const pressShadow = (pressed: boolean) => ({ boxShadow: `0 ${pressed ? 0 : 3}px 0 ${tokens.brandPrimaryPress}` });

/** Press feedback: gentle scale, no flicker. */
export const motion = {
  pressScale: 0.96,
} as const;
