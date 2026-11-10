/** @type {import('tailwindcss').Config} */
// Colors, fonts, radii and shadows come from tailwind.preset.js (generated from
// design/tokens.json — regenerate, don't hand-edit). Only app aliases live here.
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset'), require('./tailwind.preset')],
  theme: {
    extend: {
      colors: {
        muted: '#58655F',
        'text-link': '#0A746E',
        'surface-page': '#FFF7EA',
      },
    },
  },
  plugins: [],
};
