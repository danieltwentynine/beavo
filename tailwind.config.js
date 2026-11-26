/** @type {import('tailwindcss').Config} */
// Colors, fonts, type sizes, spacing, radii and shadows come from tailwind.preset.js,
// generated from design/tokens.json by scripts/build-tokens.mjs (regenerate, don't hand-edit).
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset'), require('./tailwind.preset')],
  plugins: [],
};
