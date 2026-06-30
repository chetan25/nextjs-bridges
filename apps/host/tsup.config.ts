import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { button: 'src/components/button.tsx' },
  format: ['esm'],
  outDir: 'public',
  outExtension: () => ({ js: '.chunk.js' }),
  platform: 'browser',
  target: 'es2022',
  sourcemap: false,
  dts: false,
  clean: false,
  // Bundle React into the chunk — the chunk uses its own createRoot() so
  // the consumer's React never sees any elements from this React instance.
  // Each app manages an isolated React tree; no dual-instance element type conflicts.
  noExternal: [/react/],
});
