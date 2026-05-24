import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    globals: true,
    // Node by default; component tests opt into jsdom via a top-of-file
    // `// @vitest-environment jsdom` docblock.
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx,js,jsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**', '.claude/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['lib/**', 'server/**', 'components/**', 'app/**'],
      exclude: ['**/*.d.ts', 'tests/**', '.next/**', 'next.config.ts'],
    },
  },
});
