import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildSharedDepShimSource, generateSharedDepShim } from '../src/shared-dep-shim-generator';

describe('buildSharedDepShimSource', () => {
  it('references window.__bridgeShared keyed by the dep name', () => {
    const source = buildSharedDepShimSource('date-fns', { format: () => {} });
    expect(source).toContain('globalThis.__bridgeShared?.["date-fns"]');
  });

  it('throws a descriptive runtime error mentioning the dep name and BridgeSharedDepsProvider', () => {
    const source = buildSharedDepShimSource('date-fns', { format: () => {} });
    expect(source).toContain('"date-fns"');
    expect(source).toContain('BridgeSharedDepsProvider');
  });

  it('re-exports mod.default as the default export when present, falling back to mod itself', () => {
    const source = buildSharedDepShimSource('date-fns', { format: () => {} });
    expect(source).toContain('export default (mod && mod.default) ?? mod;');
  });

  it('re-exports every non-default key as a named export', () => {
    const source = buildSharedDepShimSource('date-fns', { format: () => {}, parseISO: () => {}, default: () => {} });
    expect(source).toContain('export const { format, parseISO } = mod;');
  });

  it('omits the named-exports line when the module has no keys other than default', () => {
    const source = buildSharedDepShimSource('some-lib', { default: () => {} });
    expect(source).not.toContain('export const {');
  });
});

describe('generateSharedDepShim', () => {
  it('writes the generated shim source to the given output path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bridge-shim-'));
    const outPath = join(dir, 'nested', 'date-fns-shim.ts');

    generateSharedDepShim('date-fns', { format: () => {} }, outPath);

    const written = readFileSync(outPath, 'utf-8');
    expect(written).toContain('globalThis.__bridgeShared?.["date-fns"]');
    expect(written).toContain('export const { format } = mod;');

    rmSync(dir, { recursive: true, force: true });
  });
});
