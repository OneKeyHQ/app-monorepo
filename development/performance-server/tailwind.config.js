/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./public/**/*.{html,js}'],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0f1024',
          panel: '#161733',
          border: '#22244a',
          hover: '#1f2350',
        },
      },
      fontFamily: {
        mono: [
          'SFMono-Regular',
          'Consolas',
          'Liberation Mono',
          'Menlo',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
};
