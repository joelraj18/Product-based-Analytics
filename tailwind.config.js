/** @type {import('tailwindcss').Config} */
// Apple devices render San Francisco; everyone else gets Inter, its closest
// free lookalike (loaded in public/index.html).
const SANS = ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', 'Inter', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'];
const MONO = ['ui-monospace', '"SF Mono"', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'];

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: SANS, mono: MONO },
    },
  },
  plugins: [],
};
