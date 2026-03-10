import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './apps/web/app/**/*.{ts,tsx}',
    './apps/web/components/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        panel: '#111827',
        line: '#1f2937',
        accent: '#7c3aed'
      }
    }
  },
  plugins: []
};

export default config;
