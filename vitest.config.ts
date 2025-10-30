import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/game/__tests__/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
