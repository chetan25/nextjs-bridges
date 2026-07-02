import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/use-lazy-handler.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', 'next'],
  banner: { js: "'use client';" },
});
