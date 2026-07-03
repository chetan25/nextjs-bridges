import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import type { NextConfig } from 'next';
import type { ShareManifest, ShareConfig } from './types';
import { loadSharedDepDecisions, loadOwnVersions } from './shared-dep-resolver';

function slugifyExpose(key: string): string {
  // './Button' → 'button', './components/Card' → 'components-card'
  return key.replace(/^\.\//, '').replace(/\//g, '-').toLowerCase();
}

/**
 * Generates a `share-manifest.json` and optionally writes it to disk.
 *
 * Call this from a `prebuild` npm script or from `next.config.ts` evaluation.
 * For Turbopack builds there is no webpack plugin API, so the prebuild script
 * is the recommended approach.
 *
 * @example
 * // package.json
 * { "scripts": { "prebuild": "node -e \"require('./share.config.js')\"" } }
 */
export function generateShareManifest(
  config: ShareConfig & { outputDir?: string; sharedContractPath?: string; ownPackageJsonPath?: string },
): ShareManifest {
  const {
    name,
    version = '0.0.0',
    baseUrl = '',
    exposes,
    shared,
    outputDir,
    sharedContractPath,
    ownPackageJsonPath = './package.json',
  } = config;

  let sharedEntries: ShareManifest['shared'];
  if (shared) {
    const ownVersions = loadOwnVersions(shared, resolve(ownPackageJsonPath));
    const decisions = sharedContractPath
      ? loadSharedDepDecisions(shared, ownVersions, resolve(sharedContractPath))
      : Object.fromEntries(
          Object.keys(shared).map((dep) => [dep, { external: false, ownVersion: ownVersions[dep] }]),
        );

    sharedEntries = Object.fromEntries(
      Object.entries(shared).map(([dep, cfg]) => [
        dep,
        { version: decisions[dep].ownVersion, external: decisions[dep].external, ...cfg },
      ]),
    );
  }

  const manifest: ShareManifest = {
    name,
    version,
    baseUrl,
    exposes: Object.fromEntries(
      Object.entries(exposes).map(([key]) => [
        key,
        { chunk: `/${slugifyExpose(key)}.chunk.js`, version },
      ]),
    ),
    ...(sharedEntries ? { shared: sharedEntries } : {}),
  };

  if (outputDir !== undefined) {
    const absOut = resolve(outputDir);
    mkdirSync(absOut, { recursive: true });
    writeFileSync(
      join(absOut, 'share-manifest.json'),
      JSON.stringify(manifest, null, 2),
    );
  }

  return manifest;
}

/**
 * Next.js config wrapper for host apps that expose components via @bridge/share.
 *
 * Generates `public/share-manifest.json` during config evaluation so it is
 * available before Turbopack starts serving. For Webpack builds it also
 * regenerates on every compile.
 *
 * @example
 * // apps/host/next.config.ts
 * import { shareConfig } from '@bridge/share/next-config-helper';
 * export default shareConfig({
 *   name: 'host-app',
 *   baseUrl: 'http://localhost:3001',
 *   exposes: { './Button': './src/components/Button.tsx' },
 * })({});
 */
export function shareConfig(
  config: ShareConfig & { baseUrl?: string; sharedContractPath?: string; ownPackageJsonPath?: string },
) {
  return (nextConfig: NextConfig): NextConfig => {
    generateShareManifest({ ...config, outputDir: 'public' });

    return {
      ...nextConfig,
      webpack(
        webpackConfig: object,
        ctx: object,
      ) {
        // Re-generate on every webpack compile to pick up exposes changes.
        generateShareManifest({ ...config, outputDir: 'public' });

        const existing = (
          nextConfig as { webpack?: (c: object, x: object) => object }
        ).webpack;
        if (existing) return existing(webpackConfig, ctx);
        return webpackConfig;
      },
    };
  };
}

/**
 * Writes the shell's declared shared-dependency versions to a contract file
 * that exposing apps read at their own build time (see shared-dep-resolver.ts).
 * `provides` is explicit and authored, not auto-derived from every installed
 * dependency — the shell should only advertise deps it deliberately intends
 * to expose as stable runtime globals via <BridgeSharedDepsProvider>.
 */
export function generateSharedContract(config: {
  provides: string[];
  outputPath: string;
  ownPackageJsonPath?: string;
}): Record<string, string> {
  const { provides, outputPath, ownPackageJsonPath = './package.json' } = config;

  const ownPkg = JSON.parse(readFileSync(resolve(ownPackageJsonPath), 'utf-8')) as {
    dependencies?: Record<string, string>;
  };

  const contract: Record<string, string> = {};
  for (const dep of provides) {
    const version = ownPkg.dependencies?.[dep];
    if (!version) {
      throw new Error(`sharedDepsConfig: "${dep}" is not in dependencies of ${ownPackageJsonPath}`);
    }
    contract[dep] = version;
  }

  const absOut = resolve(outputPath);
  mkdirSync(dirname(absOut), { recursive: true });
  writeFileSync(absOut, JSON.stringify(contract, null, 2));

  return contract;
}

/**
 * Env var name a shared dep's build-time-declared version is injected under.
 * Next.js's Turbopack dev server resolves 'react'/'react-dom' for every
 * 'use client' component to its own internally-vendored canary build,
 * regardless of what's actually installed — so BridgeSharedDepsProvider
 * can't trust a live `React.version`/`ReactDOM.version` read in dev. This key
 * format must match the (duplicated, not imported — this module is Node-only)
 * copy in bridge-shared-deps-provider.tsx, which runs in the browser and reads
 * this env var instead of the live version when it's present.
 */
export function sharedDepEnvKey(dep: string): string {
  return `NEXT_PUBLIC_BRIDGE_VERSION_${dep.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
}

/**
 * Next.js config wrapper for the shell app. Regenerates the shared-dep
 * contract on config evaluation and on every webpack compile, mirroring
 * shareConfig()'s pattern for share-manifest.json. Also injects each
 * provided dep's declared version as a NEXT_PUBLIC_BRIDGE_VERSION_* env var
 * (see sharedDepEnvKey) so BridgeSharedDepsProvider can publish a build-time
 * fact instead of a runtime-observed value Turbopack's dev server can corrupt.
 */
export function sharedDepsConfig(config: {
  provides: string[];
  outputPath: string;
  ownPackageJsonPath?: string;
}) {
  return (nextConfig: NextConfig): NextConfig => {
    const contract = generateSharedContract(config);
    const env = Object.fromEntries(
      Object.entries(contract).map(([dep, version]) => [sharedDepEnvKey(dep), version]),
    );

    return {
      ...nextConfig,
      env: { ...nextConfig.env, ...env },
      webpack(webpackConfig: object, ctx: object) {
        generateSharedContract(config);

        const existing = (nextConfig as { webpack?: (c: object, x: object) => object }).webpack;
        if (existing) return existing(webpackConfig, ctx);
        return webpackConfig;
      },
    };
  };
}
