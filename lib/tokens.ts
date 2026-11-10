/**
 * Beavo design tokens — "Toy box". Values come from the design-system code export
 * (zing-design-system/src/theme/tokens.ts); tailwind.preset.js carries the same
 * values as NativeWind classes. Use these where classes can't reach: SVG fills,
 * shadows, inline styles.
 *
 * Signature: 3px ink outline + hard drop shadow, no blur, no gradients.
 */
export const palette = {
  cobalt: {
    50: '#eef2ff',
    100: '#d9e2ff',
    200: '#b5c6ff',
    300: '#87a2ff',
    400: '#5b7eff',
    500: '#2d5bff',
    600: '#1f45db',
    700: '#1835ad',
    800: '#142a85',
    900: '#121f5e',
  },
  sky: {
    50: '#eaf7fe',
    100: '#cdecfd',
    200: '#a3ddfb',
    300: '#71cbf9',
    400: '#4fc3f7',
    500: '#29aeee',
    600: '#1690d2',
    700: '#1372a8',
    800: '#155f88',
    900: '#164e6f',
  },
  ink: {
    900: '#14142b',
    700: '#33335a',
    600: '#44446b',
    500: '#55557a',
    400: '#696989',
    300: '#c4c4d6',
    200: '#e1e1eb',
    100: '#f0f0f6',
    50: '#f8f8fb',
  },
  white: '#ffffff',
  sunny: { 100: '#fff3c4', 500: '#ffd23f', 600: '#f2be14' },
  bubblegum: { 100: '#ffe0ef', 500: '#ff6fb5', 600: '#d6247a' },
  coral: { 100: '#ffe1e5', 500: '#ff7a8a' },
  grape: { 100: '#ebe7ff', 500: '#9b8cff' },
  warning: { 100: '#fff1dc', 500: '#ffb347' },
  danger: { 100: '#fde8e8', 500: '#dc2626' },
} as const;

/** Semantic aliases — author UIs against these, not the raw ramps. */
export const tokens = {
  textPrimary: '#14142b',
  textSecondary: '#55557a',
  textTertiary: '#696989',
  textOnBrand: '#ffffff',
  textLink: '#1f45db',

  surfacePage: '#fff6da',
  surfaceCard: '#ffffff',
  surfaceSunken: '#f8f8fb',
  surfaceMint: '#eef2ff',
  surfaceSky: '#fff3c4',

  brandPrimary: '#2d5bff',
  brandPrimaryPress: '#1f45db',
  brandSecondary: '#d6247a',
  brandSecondaryPress: '#ff6fb5',

  borderSubtle: '#14142b',
  borderStrong: '#14142b',
  borderFocus: '#2d5bff',

  feedbackWarning: '#ffb347',
  feedbackDanger: '#dc2626',
  feedbackSuccess: '#2d5bff',
  feedbackReward: '#ffd23f',

  // Mouth-map zone states
  zoneEmpty: '#e1e1eb',
  zoneActive: '#87a2ff',
  zoneDone: '#2d5bff',
  zoneMissed: '#ffb347',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  pill: 9999,
} as const;

/** Static weights: pick the family, never fontWeight. Loaded in app/_layout.tsx. */
export const font = {
  display: 'Fredoka-Bold',
  displaySemi: 'Fredoka-SemiBold',
  displayMedium: 'Fredoka-Medium',
  body: 'Lexend-Regular',
  bodySemi: 'Lexend-SemiBold',
  numeric: 'Fredoka-Bold',
} as const;

/** 3px ink outline — every card, button, tile and sticker. */
export const outline = { borderWidth: 3, borderColor: tokens.borderStrong } as const;

/** Outline + hard ink drop (RN `boxShadow`, New Architecture). Smaller drop = pressed. */
export const hardShadow = (drop: 3 | 5 | 6 | 8 = 6) => ({
  ...outline,
  boxShadow: `0 ${drop}px 0 ${tokens.textPrimary}`,
});

/** Press feedback: scale to 0.96 and the drop shrinks, like pushing a toy button. */
export const motion = {
  pressScale: 0.96,
} as const;
