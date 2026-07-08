import { defineConfig } from 'tsup';
import { resolve } from 'path';
import { loadSharedDepDecisions, loadOwnVersions } from '@nextjs-bridges/share/shared-dep-resolver';

const SHARED = { react: {}, 'react-dom': {} };
const ownVersions = loadOwnVersions(SHARED, resolve(process.cwd(), 'package.json'));
const decisions = loadSharedDepDecisions(
  SHARED,
  ownVersions,
  resolve(process.cwd(), '../../packages/share/shared-contract.json'),
);

export default defineConfig({
  entry: {
    homewidget: 'src/components/home-team/home-widget.tsx',
    popularproductspanel: 'src/components/recommendations-team/popular-products-panel.tsx',
  },
  format: ['esm'],
  outDir: 'public',
  outExtension: () => ({ js: '.chunk.js' }),
  platform: 'browser',
  target: 'es2022',
  sourcemap: false,
  dts: false,
  clean: false,
  noExternal: [/react/, '@nextjs-bridges/lazy-handler'],
  esbuildOptions(options) {
    options.alias = {
      ...options.alias,
      ...(decisions.react?.external
        ? { react: resolve(process.cwd(), '../../packages/share/src/shims/react-shim.ts') }
        : {}),
      ...(decisions['react-dom']?.external
        ? {
            'react-dom': resolve(process.cwd(), '../../packages/share/src/shims/react-dom-shim.ts'),
            'react-dom/client': resolve(
              process.cwd(),
              '../../packages/share/src/shims/react-dom-client-shim.ts',
            ),
          }
        : {}),
    };
  },
});
