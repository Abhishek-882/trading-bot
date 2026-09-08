/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        gmgn: {
          bg:       '#0d0d0f',
          surface:  '#16181c',
          border:   '#2a2d35',
          accent:   '#00d4aa',
          yellow:   '#f5c542',
          red:      '#ff4d4d',
          green:    '#00d4aa',
          muted:    '#6b7280',
          text:     '#e5e7eb',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
