import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ['react', 'react-dom', 'next'],
    banner: { js: "'use client';" },
  },
  {
    entry: ['src/next-config-helper.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    external: ['next', 'react', 'react-dom'],
    platform: 'node',
  },
  {
    entry: ['src/shared-dep-resolver.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    platform: 'node',
  },
]);
