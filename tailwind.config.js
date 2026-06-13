/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#071d3a',
          orange: '#ff7a00',
          blue: '#2563eb',
          surface: '#f3f6fa'
        }
      },
      fontFamily: {
        sans: ['Be Vietnam Pro', 'Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
