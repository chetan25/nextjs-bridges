import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { generateSharedContract, generateShareManifest } from '../src/next-config-helper';

describe('generateSharedContract', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  function makeAppDir(deps: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), 'bridge-app-'));
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: deps }));
    dirs.push(dir);
    return dir;
  }

  it('writes the declared deps and their versions to outputPath', () => {
    const appDir = makeAppDir({ react: '^18.3.1', 'react-dom': '^18.3.1' });
    const outputPath = join(appDir, 'shared-contract.json');

    const contract = generateSharedContract({
      provides: ['react', 'react-dom'],
      outputPath,
      ownPackageJsonPath: join(appDir, 'package.json'),
    });

    expect(contract).toEqual({ react: '^18.3.1', 'react-dom': '^18.3.1' });
    expect(JSON.parse(readFileSync(outputPath, 'utf-8'))).toEqual(contract);
  });

  it('throws when a declared dep is not actually in package.json dependencies', () => {
    const appDir = makeAppDir({ react: '^18.3.1' });
    expect(() =>
      generateSharedContract({
        provides: ['react', 'react-dom'],
        outputPath: join(appDir, 'shared-contract.json'),
        ownPackageJsonPath: join(appDir, 'package.json'),
      }),
    ).toThrow('"react-dom" is not in dependencies');
  });

  it('creates the output directory if it does not exist', () => {
    const appDir = makeAppDir({ react: '^18.3.1' });
    const outputPath = join(appDir, 'nested', 'dir', 'shared-contract.json');

    generateSharedContract({
      provides: ['react'],
      outputPath,
      ownPackageJsonPath: join(appDir, 'package.json'),
    });

    expect(JSON.parse(readFileSync(outputPath, 'utf-8'))).toEqual({ react: '^18.3.1' });
  });
});

describe('generateShareManifest — shared dep annotation', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  function makeAppDir(deps: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), 'bridge-host-'));
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: deps }));
    dirs.push(dir);
    return dir;
  }

  it('records own version and external:true when the contract is compatible', () => {
    const appDir = makeAppDir({ react: '18.2.0' });
    const contractPath = join(appDir, 'shared-contract.json');
    writeFileSync(contractPath, JSON.stringify({ react: '18.3.0' }));

    const manifest = generateShareManifest({
      name: 'host-app',
      version: '1.0.0',
      exposes: { './Button': './src/components/button.tsx' },
      shared: { react: {} },
      sharedContractPath: contractPath,
      ownPackageJsonPath: join(appDir, 'package.json'),
    });

    expect(manifest.shared?.react).toEqual({ version: '18.2.0', external: true });
  });

  it('records external:false when no sharedContractPath is given', () => {
    const appDir = makeAppDir({ react: '18.2.0' });

    const manifest = generateShareManifest({
      name: 'host-app',
      version: '1.0.0',
      exposes: { './Button': './src/components/button.tsx' },
      shared: { react: {} },
      ownPackageJsonPath: join(appDir, 'package.json'),
    });

    expect(manifest.shared?.react).toEqual({ version: '18.2.0', external: false });
  });

  it('preserves singleton flag alongside the computed version/external fields', () => {
    const appDir = makeAppDir({ react: '18.2.0' });

    const manifest = generateShareManifest({
      name: 'host-app',
      version: '1.0.0',
      exposes: { './Button': './src/components/button.tsx' },
      shared: { react: { singleton: true } },
      ownPackageJsonPath: join(appDir, 'package.json'),
    });

    expect(manifest.shared?.react).toEqual({ version: '18.2.0', external: false, singleton: true });
  });
});
