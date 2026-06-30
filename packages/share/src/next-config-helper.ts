import { writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import type { NextConfig } from 'next';
import type { ShareManifest, ShareConfig } from './types';

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
  config: ShareConfig & { outputDir?: string },
): ShareManifest {
  const {
    name,
    version = '0.0.0',
    baseUrl = '',
    exposes,
    shared,
    outputDir,
  } = config;

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
    ...(shared
      ? {
          shared: Object.fromEntries(
            Object.entries(shared).map(([pkg, cfg]) => [
              pkg,
              { version: '0.0.0', ...cfg },
            ]),
          ),
        }
      : {}),
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
export function shareConfig(config: ShareConfig & { baseUrl?: string }) {
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
