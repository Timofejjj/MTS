/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // MTS Brand Colors
        mts: {
          red: '#E30611',
          dark: '#1A1A1A',
          gray: '#F5F5F5',
        },
        primary: {
          50: '#fff1f1',
          100: '#ffdede',
          500: '#E30611',
          600: '#c40510',
          700: '#a0040d',
          900: '#6b0209',
        },
      },
    },
  },
  plugins: [],
};
