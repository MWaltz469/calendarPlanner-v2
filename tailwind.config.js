/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './*.html',
    './*.js',
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0f766e',
          light: '#14b8a6',
          dark: '#115e59',
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#0f766e',
          600: '#115e59',
          700: '#134e4a',
          800: '#1a3f3b',
          900: '#0f2b2a',
        }
      },
      fontFamily: {
        display: ['Sora', 'sans-serif'],
        body: ['Manrope', 'sans-serif'],
      },
    }
  }
};
