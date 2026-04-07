/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        apollo: {
          green:      '#10B981',
          mint:       '#34D399',
          'mint-bright': '#6EE7B7',
          charcoal:   '#121212',
          'deep-forest': '#0D1B14',
          forest:     '#0F2318',
          'mid-forest': '#1A3A28',
          border:     '#1E4D30',
          gold:       '#C9A84C',
          muted:      '#86EFAC',
          dim:        '#4ADE80',
        },
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'sans-serif'],
        heading: ['"Barlow Semi Condensed"', 'sans-serif'],
        body:    ['"DM Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'apollo-grid': 'linear-gradient(#10B981 1px, transparent 1px), linear-gradient(90deg, #10B981 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
};
