import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['packages/*/test/**/*.test.{ts,tsx}', 'packages/*/src/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/.next/**'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**'],
      exclude: ['**/node_modules/**', '**/dist/**'],
    },
  },
});
