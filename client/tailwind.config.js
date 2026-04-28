/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        arm: {
          DEFAULT: '#7CC23A',
          dim: 'rgba(124,194,58,0.12)',
          hover: '#90D44E',
        },
        surface: '#141417',
        base: '#0C0C0E',
        elevated: '#1E1E22',
      },
    },
  },
  plugins: [],
}
