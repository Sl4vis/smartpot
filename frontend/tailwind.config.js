/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        sage: {
          50:  '#f6f7f5',
          100: '#eaede7',
          200: '#dde2d8',
          300: '#c4ccbb',
          400: '#a3af96',
          500: '#889978',
          600: '#6b7c5c',
          700: '#566349',
          800: '#47513d',
          900: '#3c4435',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      }
    },
  },
  plugins: [],
};
