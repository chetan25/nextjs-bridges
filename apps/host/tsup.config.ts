import { defineConfig } from 'tsup';
import { resolve } from 'path';
import { loadSharedDepDecisions, loadOwnVersions } from '@bridge/share/shared-dep-resolver';

const SHARED = { react: {}, 'react-dom': {} };
const ownVersions = loadOwnVersions(SHARED, resolve(process.cwd(), 'package.json'));
const decisions = loadSharedDepDecisions(
  SHARED,
  ownVersions,
  resolve(process.cwd(), '../../packages/share/shared-contract.json'),
);

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
  // Bundle React into the chunk by default (tsup would otherwise treat any
  // package.json dependency as external) — unchanged from before this plan.
  // Which *implementation* gets bundled (the real package, or a shim reading
  // window.__bridgeShared) is controlled entirely by esbuildOptions.alias below.
  noExternal: [/react/],
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
