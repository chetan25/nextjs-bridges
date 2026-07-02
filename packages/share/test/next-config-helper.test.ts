import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { generateSharedContract } from '../src/next-config-helper';

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
