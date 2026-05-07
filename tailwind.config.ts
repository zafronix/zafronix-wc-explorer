import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50:  '#f8f7fb',
          100: '#e9e7f1',
          300: '#a8a4c0',
          400: '#878398',
          500: '#5e5b80',
          700: '#2a2547',
          800: '#1a1730',
          900: '#16132a',
          950: '#0c0a16',
        },
        brand: {
          300: '#c2adff',
          400: '#a384ff',
          500: '#8a5eff',
          600: '#6C3CE0',
          700: '#5832b8',
        },
        accent: {
          gold:  '#facc15',
          green: '#22c55e',
          red:   '#ef4444',
          blue:  '#60a5fa',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
