/** @type {import('tailwindcss').Config} */
// Apple devices render San Francisco; everyone else gets Inter, its closest
// free lookalike (loaded in public/index.html).
const SANS = ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', 'Inter', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'];
const MONO = ['ui-monospace', '"SF Mono"', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'];

// Apple store look: warm neutrals instead of cool slate, Apple's link blue,
// and a beige accent sampled from the natural titanium phone finish.
const WARM = {
  50: '#faf9f6',
  100: '#f4f2ee',
  200: '#e8e5df',
  300: '#d6d2ca',
  400: '#a8a39b',
  500: '#86837d',
  600: '#6e6b66',
  700: '#4f4d49',
  800: '#333230',
  900: '#1d1d1f',
  950: '#111112',
};
const APPLE_BLUE = {
  50: '#eef6ff',
  100: '#dcecff',
  200: '#b9d8fe',
  300: '#86bbfb',
  400: '#4e9bf6',
  500: '#1a82ee',
  600: '#0071e3',
  700: '#0062c4',
  800: '#004f9f',
  900: '#003e7e',
  950: '#00264f',
};
const BEIGE = {
  50: '#fbf9f5',
  100: '#f5f0e8',
  200: '#ece3d5',
  300: '#e0d3bf',
  400: '#cdbb9f',
  500: '#b5a081',
  600: '#97805f',
  700: '#76644b',
  800: '#554837',
  900: '#3a3126',
};

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: SANS, mono: MONO },
      colors: { slate: WARM, blue: APPLE_BLUE, beige: BEIGE },
      boxShadow: {
        soft: '0 1px 2px rgb(29 29 31 / 0.04), 0 4px 16px rgb(29 29 31 / 0.06)',
        lift: '0 2px 6px rgb(29 29 31 / 0.06), 0 12px 32px rgb(29 29 31 / 0.10)',
      },
    },
  },
  plugins: [],
};
