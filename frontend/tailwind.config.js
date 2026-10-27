/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        xs: '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
      },
      colors: {
        muted: {
          teal: '#7CA7A6',
          pink: '#B8748C',
          orange: '#C49A70',
          green: '#7FA080',
        },
        warm: {
          50: '#FDFCF9',
          100: '#FAF8F5',
          200: '#F4EFEA',
          300: '#ECE6DE',
          400: '#DFD7CC',
          500: '#C2B8AA',
          800: '#2C2723',
          900: '#1C1917',
        },
        navy: {
          50: '#F0F6F5',
          100: '#DFECEB',
          200: '#C2DBD9',
          600: '#689493',
          700: '#557A79',
          800: '#436160',
          900: '#324847',
        },
        brand: {
          50: '#F0F6F5',
          100: '#DFECEB',
          200: '#C2DBD9',
          300: '#A0C6C5',
          400: '#8FB6B5',
          500: '#7CA7A6',
          600: '#689493',
          700: '#557A79',
          800: '#436160',
          900: '#324847',
        }
      }
    },
  },
  plugins: [],
}
