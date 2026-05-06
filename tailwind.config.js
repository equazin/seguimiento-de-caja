/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#070A12',
        surface: '#111622',
        border: '#293143',
        'surface-2': '#171D2B',
        'surface-3': '#20283A',
        primary: {
          DEFAULT: '#6D6AF8',
          hover: '#5956E9',
          foreground: '#ffffff',
        },
        success: '#25C76F',
        danger: '#F25A5A',
        warning: '#F2A93B',
        info: '#4DA3FF',
        muted: '#667085',
        'muted-foreground': '#A7B1C2',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
      },
    },
  },
  plugins: [],
}
