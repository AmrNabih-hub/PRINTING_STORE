import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Direct hex colors
        midnight: {
          bg: '#0B0C10',
          card: '#1F2833',
          text: '#C5C6C7',
          accent: '#C5A880',
        },
        alabaster: {
          bg: '#F9F9F9',
          card: '#FFFFFF',
          text: '#1A1A1D',
          accent: '#B8860B',
        },
        // Theme variables for CSS properties mapping
        background: 'var(--background)',
        card: 'var(--card)',
        text: 'var(--text)',
        accent: 'var(--accent)',
      },
    },
  },
  plugins: [],
};

export default config;
