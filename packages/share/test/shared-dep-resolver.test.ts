import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { resolveSharedDeps, readContract, loadSharedDepDecisions, loadOwnVersions } from '../src/shared-dep-resolver';

describe('resolveSharedDeps', () => {
  it('externalizes when own version exactly matches the contract', () => {
    const result = resolveSharedDeps(
      { react: {} },
      { react: '18.3.0' },
      { react: '18.3.0' },
    );
    expect(result.react).toEqual({ external: true, ownVersion: '18.3.0', contractVersion: '18.3.0' });
  });

  it('externalizes when own minor is lower than the contract, same major', () => {
    const result = resolveSharedDeps({ react: {} }, { react: '18.2.0' }, { react: '18.3.0' });
    expect(result.react.external).toBe(true);
  });

  it('does not externalize when own minor is higher than the contract', () => {
    const result = resolveSharedDeps({ react: {} }, { react: '18.4.0' }, { react: '18.3.0' });
    expect(result.react.external).toBe(false);
  });

  it('does not externalize when major differs', () => {
    const result = resolveSharedDeps({ react: {} }, { react: '17.0.0' }, { react: '18.3.0' });
    expect(result.react.external).toBe(false);
  });

  it('strips ^ and ~ prefixes from both own and contract versions', () => {
    const result = resolveSharedDeps({ react: {} }, { react: '^18.2.0' }, { react: '~18.3.0' });
    expect(result.react.external).toBe(true);
  });

  it('does not externalize when own version is missing', () => {
    const result = resolveSharedDeps({ react: {} }, {}, { react: '18.3.0' });
    expect(result.react).toEqual({ external: false, ownVersion: 'unknown' });
  });

  it('does not externalize when the contract has no entry for the dep', () => {
    const result = resolveSharedDeps({ react: {} }, { react: '18.3.0' }, {});
    expect(result.react).toEqual({ external: false, ownVersion: '18.3.0' });
  });

  it('resolves each shared dep independently', () => {
    const result = resolveSharedDeps(
      { react: {}, 'react-dom': {} },
      { react: '18.3.0', 'react-dom': '17.0.0' },
      { react: '18.3.0', 'react-dom': '18.3.0' },
    );
    expect(result.react.external).toBe(true);
    expect(result['react-dom'].external).toBe(false);
  });
});

describe('readContract', () => {
  it('parses an existing contract file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bridge-contract-'));
    const path = join(dir, 'shared-contract.json');
    writeFileSync(path, JSON.stringify({ react: '18.3.1' }));

    expect(readContract(path)).toEqual({ react: '18.3.1' });
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns an empty object when the file does not exist', () => {
    expect(readContract('/nonexistent/shared-contract.json')).toEqual({});
  });

  it('returns an empty object when the file is not valid JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bridge-contract-'));
    const path = join(dir, 'shared-contract.json');
    writeFileSync(path, 'not json');

    expect(readContract(path)).toEqual({});
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('loadSharedDepDecisions', () => {
  it('reads the contract from disk and resolves decisions', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bridge-contract-'));
    const path = join(dir, 'shared-contract.json');
    writeFileSync(path, JSON.stringify({ react: '18.3.1' }));

    const result = loadSharedDepDecisions({ react: {} }, { react: '18.3.0' }, path);
    expect(result.react.external).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it('falls back to all-bundled when the contract file is missing', () => {
    const result = loadSharedDepDecisions({ react: {} }, { react: '18.3.0' }, '/nonexistent/contract.json');
    expect(result.react.external).toBe(false);
  });
});

describe('loadOwnVersions', () => {
  it('reads each shared dep\'s version from package.json dependencies', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bridge-pkg-'));
    const path = join(dir, 'package.json');
    writeFileSync(path, JSON.stringify({ dependencies: { react: '^18.3.0', 'react-dom': '^18.3.0', unrelated: '^1.0.0' } }));

    expect(loadOwnVersions({ react: {}, 'react-dom': {} }, path)).toEqual({
      react: '^18.3.0',
      'react-dom': '^18.3.0',
    });
    rmSync(dir, { recursive: true, force: true });
  });

  it('defaults to "0.0.0" for a shared dep missing from dependencies', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bridge-pkg-'));
    const path = join(dir, 'package.json');
    writeFileSync(path, JSON.stringify({ dependencies: {} }));

    expect(loadOwnVersions({ react: {} }, path)).toEqual({ react: '0.0.0' });
    rmSync(dir, { recursive: true, force: true });
  });
});
