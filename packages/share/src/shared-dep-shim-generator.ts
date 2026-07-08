import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

/**
 * Builds the source for a generic shared-dep shim: a small module that
 * re-exports whatever `mod` (the real library's exports, already introspected
 * by the caller) provides, but reading them off window.__bridgeShared[dep] at
 * runtime instead of bundling the real library. Named exports are re-declared
 * statically (required by ES module syntax) from `Object.keys(mod)` — this is
 * the same shape the hand-written react-shim.ts/react-dom-shim.ts use, just
 * generated instead of hand-typed, so it works for any library's export set.
 */
export function buildSharedDepShimSource(dep: string, mod: Record<string, unknown>): string {
  const depKey = JSON.stringify(dep);
  const namedExports = Object.keys(mod).filter((k) => k !== 'default');

  const lines = [
    `const mod = globalThis.__bridgeShared?.[${depKey}];`,
    `if (!mod) {`,
    `  throw new Error(`,
    `    '@nextjs-bridges/share: window.__bridgeShared[${depKey}] was not available when this chunk loaded. ' +`,
    `      'Make sure <BridgeSharedDepsProvider shared={{ ${depKey}: ... }}> wraps the page before any remote component mounts.',`,
    `  );`,
    `}`,
    ``,
    `export default (mod && mod.default) ?? mod;`,
  ];

  if (namedExports.length > 0) {
    lines.push(`export const { ${namedExports.join(', ')} } = mod;`);
  }

  return lines.join('\n') + '\n';
}

/** Writes a generated shared-dep shim to `outputPath`, creating parent directories as needed. */
export function generateSharedDepShim(
  dep: string,
  mod: Record<string, unknown>,
  outputPath: string,
): void {
  const absOut = resolve(outputPath);
  mkdirSync(dirname(absOut), { recursive: true });
  writeFileSync(absOut, buildSharedDepShimSource(dep, mod));
}
