/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        arm: {
          DEFAULT: '#7CC23A',
          dim: 'rgba(124,194,58,0.10)',
          hover: '#6AB32B',
        },
        surface: '#FFFFFF',
        base: '#F4F6F8',
        elevated: '#EEF0F3',
      },
    },
  },
  plugins: [],
}
