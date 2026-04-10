/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Flat Apollo brand tokens — use as bg-charcoal, text-green, etc.
        charcoal:  '#0D1B14',
        forest:    '#0F2318',
        elevated:  '#1A3A28',
        border:    '#1E4D30',
        green:     '#10B981',
        mint:      '#34D399',
        mintlight: '#6EE7B7',
        gold:      '#C9A84C',
        offwhite:  '#F0FFF4',
        muted:     '#86EFAC',
        dim:       '#4ADE80',
        danger:    '#EF4444',
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'sans-serif'],
        sans:    ['"DM Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
