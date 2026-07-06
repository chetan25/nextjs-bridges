import { defineConfig } from 'tsup';
import { resolve } from 'path';
import { createRequire } from 'module';
import { loadSharedDepDecisions, loadOwnVersions } from '@chetand/share/shared-dep-resolver';
import { generateSharedDepShim } from '@chetand/share/shared-dep-shim-generator';

// tsup bundles this config file itself as ESM without a require() shim, so a
// bare `require(dep)` fails at config-load time even though it works fine
// inside the actual chunk entries (which set platform: 'node'/'browser'
// explicitly). createRequire gives this file its own working require().
const require = createRequire(import.meta.url);

const SHARED = { react: {}, 'react-dom': {}, 'date-fns': {} };
const ownVersions = loadOwnVersions(SHARED, resolve(process.cwd(), 'package.json'));
const decisions = loadSharedDepDecisions(
  SHARED,
  ownVersions,
  resolve(process.cwd(), '../../packages/share/shared-contract.json'),
);

// Any shared dep other than react/react-dom (which use hand-written shims for
// full named-export support) gets a shim generated on the fly, by introspecting
// the real, installed library's own exports — see shared-dep-shim-generator.ts.
const GENERIC_SHARED_DEPS = Object.keys(SHARED).filter(
  (dep) => dep !== 'react' && dep !== 'react-dom',
);
const genericShimAliases: Record<string, string> = {};
for (const dep of GENERIC_SHARED_DEPS) {
  if (!decisions[dep]?.external) continue;
  const shimPath = resolve(process.cwd(), '.bridge-shims', `${dep}-shim.ts`);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  generateSharedDepShim(dep, require(dep), shimPath);
  genericShimAliases[dep] = shimPath;
}

export default defineConfig({
  entry: {
    button: 'src/components/button.tsx',
    // Key must match slugifyExpose('./CartWidget') (strips './', lowercases,
    // no hyphen) from packages/share/src/next-config-helper.ts:7-9 — the
    // manifest's chunk path is derived from the expose key independently of
    // this entry key, so 'cart-widget' here would silently mismatch it.
    cartwidget: 'src/components/checkout-team/cart-widget.tsx',
  },
  format: ['esm'],
  outDir: 'public',
  outExtension: () => ({ js: '.chunk.js' }),
  platform: 'browser',
  target: 'es2022',
  sourcemap: false,
  dts: false,
  clean: false,
  // Bundle React (and any other shared dep) into the chunk by default (tsup
  // would otherwise treat any package.json dependency as external) — unchanged
  // from before this plan, extended to cover every generic shared dep too.
  // Which *implementation* gets bundled (the real package, or a shim reading
  // window.__bridgeShared) is controlled entirely by esbuildOptions.alias below.
  noExternal: [/react/, '@chetand/lazy-handler', ...GENERIC_SHARED_DEPS],
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
      ...genericShimAliases,
    };
  },
});
