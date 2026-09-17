import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/pages/')) return 'pages';
          if (id.includes('/src/components/')) return 'components';
          if (id.includes('/src/quantum/')) return 'quantum';
          if (id.includes('/src/services/')) return 'services';
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
