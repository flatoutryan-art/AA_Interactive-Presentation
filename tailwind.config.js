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
        charcoal: '#0D1B14',
        'deep-forest': '#0F2318',
        forest: '#1A3A28',
        'mid-forest': '#1E4D30',
        green: '#10B981',
        mint: '#34D399',
        'mint-bright': '#6EE7B7',
        gold: '#C9A84C',
        white: '#F0FFF4',
        muted: '#86EFAC',
        dim: '#4ADE80',
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'sans-serif'],
        heading: ['"Barlow Semi Condensed"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
