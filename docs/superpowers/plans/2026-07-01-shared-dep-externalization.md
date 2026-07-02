# Build-Time Shared Dependency Externalization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `apps/host` skip bundling React/React-DOM into an exposed chunk when `apps/web` (the shell) guarantees a compatible version is already on the page, cutting duplicate dependency bytes per exposed component while leaving the existing bundled-fallback behavior untouched when versions are incompatible.

**Architecture:** `apps/web` declares (via a new `sharedDepsConfig()` Next config helper) which deps + versions it can provide, writing `packages/share/shared-contract.json`. `apps/host`'s `tsup.config.ts` reads that contract plus its own `package.json` versions through a new pure `resolveSharedDeps()` function, and per-dependency either marks it `external` (aliasing the bare import to a shim that reads a page-level global) or leaves it bundled exactly as today. The manifest records the decision; a runtime guard (`assertSharedDepsAvailable`) re-verifies the live shell version before mounting, since the build-time decision is a snapshot that can go stale.

**Tech Stack:** TypeScript, tsup/esbuild (chunk builds), Next.js 15 App Router (Turbopack for dev/prod app builds — unrelated to chunk builds, which always go through tsup), Vitest + Testing Library + jsdom (existing test setup in `packages/share`).

## Global Constraints

- This is monorepo-local only: `apps/host` and `apps/web` read/write a shared file directly off the local filesystem via a fixed relative path (`../../packages/share/shared-contract.json`), no HTTP fetch. Documented non-goal: separately-deployed repos.
- Compatibility rule (from the approved spec): compatible when `own.major === contract.major && own.minor <= contract.minor`. No patch-level comparison.
- `apps/host`'s own version must be **no newer** than what `apps/web` provides — `apps/web`'s copy is what actually runs.
- If the contract file is missing, unreadable, or doesn't list a dep, that dep resolves to `external: false` (today's bundled behavior) — never a build failure.
- Runtime mismatch (shell's live version no longer satisfies what the chunk's manifest recorded) is a hard error surfaced through the existing `RemoteErrorBoundary`, not a silent fallback — an externalized chunk has no bundled fallback to degrade to.
- `RemoteComponent`/`useRemoteComponent` remain client-only (`'use client'`); this feature does not add any SSR or Server Component support and isn't expected to.
- Spec reference: `docs/superpowers/specs/2026-07-01-shared-dep-externalization-design.md`.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `packages/share/src/shared-dep-resolver.ts` | Create | Pure compatibility-decision logic + file-reading wrapper |
| `packages/share/test/shared-dep-resolver.test.ts` | Create | Unit tests for the above |
| `packages/share/src/types.ts` | Modify | Add `external?: boolean` to `ShareManifest.shared` entries |
| `packages/share/package.json` | Modify | Add `./shared-dep-resolver` export |
| `packages/share/tsup.config.ts` | Modify | Add build entry for `shared-dep-resolver.ts` |
| `packages/share/src/next-config-helper.ts` | Modify | Add `generateSharedContract()` / `sharedDepsConfig()`; fix `generateShareManifest()`'s hardcoded `'0.0.0'` shared version |
| `packages/share/test/next-config-helper.test.ts` | Create | Tests for both config helpers using a temp directory |
| `packages/share/src/shims/react-shim.ts` | Create | Re-exports `window.__bridgeShared.react` |
| `packages/share/src/shims/react-dom-shim.ts` | Create | Re-exports `window.__bridgeShared['react-dom']` |
| `packages/share/src/shims/react-dom-client-shim.ts` | Create | Re-exports `window.__bridgeShared['react-dom/client']` (this is what `createRoot` actually lives in) |
| `packages/share/test/shims.test.ts` | Create | Named-export parity tests against the real packages |
| `packages/share/src/bridge-shared-deps-provider.tsx` | Create | Client Component that publishes `window.__bridgeShared` |
| `packages/share/test/bridge-shared-deps-provider.test.tsx` | Create | Tests for the provider |
| `packages/share/src/shared-dep-guard.ts` | Create | `assertSharedDepsAvailable()` runtime check |
| `packages/share/test/shared-dep-guard.test.ts` | Create | Tests for the guard |
| `packages/share/src/use-remote-component.tsx` | Modify | Call the guard before loading a chunk |
| `packages/share/test/use-remote-component.test.tsx` | Modify | Add guard-triggered cases |
| `packages/share/src/index.ts` | Modify | Export `BridgeSharedDepsProvider` |
| `apps/host/tsup.config.ts` | Modify | Compute per-dep decisions; dynamic `external`/`noExternal`/alias |
| `apps/host/next.config.ts` | Modify | Declare `shared` in `shareConfig()`, pass `sharedContractPath` |
| `apps/web/next.config.ts` | Modify | Add `sharedDepsConfig({ provides: [...] })` |
| `apps/web/app/layout.tsx` | Modify | Wrap `children` in `<BridgeSharedDepsProvider>` |
| `turbo.json` | Modify | `apps/host`'s build must wait on `apps/web`'s build |

---

## Task 1: `resolveSharedDeps()` — pure compatibility decision

**Files:**
- Create: `packages/share/src/shared-dep-resolver.ts`
- Test: `packages/share/test/shared-dep-resolver.test.ts`

**Interfaces:**
- Produces: `export interface SharedDepDecision { external: boolean; ownVersion: string; contractVersion?: string }`, `export function resolveSharedDeps(shared: Record<string, { singleton?: boolean }>, ownVersions: Record<string, string>, contract: Record<string, string>): Record<string, SharedDepDecision>`

- [ ] **Step 1: Write the failing tests**

```ts
// packages/share/test/shared-dep-resolver.test.ts
import { describe, it, expect } from 'vitest';
import { resolveSharedDeps } from '../src/shared-dep-resolver';

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @bridge/share test -- shared-dep-resolver`
Expected: FAIL — `Cannot find module '../src/shared-dep-resolver'`

- [ ] **Step 3: Implement**

```ts
// packages/share/src/shared-dep-resolver.ts
export interface SharedDepDecision {
  external: boolean;
  ownVersion: string;
  contractVersion?: string;
}

interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

function parseVersion(raw: string): SemVer {
  const clean = raw.replace(/^[\^~]/, '').replace(/[-+].*$/, '');
  const [major = 0, minor = 0, patch = 0] = clean.split('.').map(Number);
  return { major, minor, patch };
}

/**
 * Decides, per shared dependency, whether apps/host's own version is
 * compatible enough with what apps/web guarantees to skip bundling it.
 * Compatible means: same major, and own minor <= contract minor — apps/web's
 * copy is what actually runs, so it must be at least as new as what the
 * exposed component was built against.
 */
export function resolveSharedDeps(
  shared: Record<string, { singleton?: boolean }>,
  ownVersions: Record<string, string>,
  contract: Record<string, string>,
): Record<string, SharedDepDecision> {
  const result: Record<string, SharedDepDecision> = {};

  for (const dep of Object.keys(shared)) {
    const ownRaw = ownVersions[dep];
    if (!ownRaw) {
      result[dep] = { external: false, ownVersion: 'unknown' };
      continue;
    }

    const contractRaw = contract[dep];
    if (!contractRaw) {
      result[dep] = { external: false, ownVersion: ownRaw };
      continue;
    }

    const own = parseVersion(ownRaw);
    const provided = parseVersion(contractRaw);
    const external = own.major === provided.major && own.minor <= provided.minor;

    result[dep] = { external, ownVersion: ownRaw, contractVersion: contractRaw };
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @bridge/share test -- shared-dep-resolver`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/share/src/shared-dep-resolver.ts packages/share/test/shared-dep-resolver.test.ts
git commit -m "feat(share): add resolveSharedDeps compatibility check"
```

---

## Task 2: `readContract()` + `loadSharedDepDecisions()` — file-reading wrapper

**Files:**
- Modify: `packages/share/src/shared-dep-resolver.ts`
- Test: `packages/share/test/shared-dep-resolver.test.ts`

**Interfaces:**
- Consumes: `resolveSharedDeps` from Task 1.
- Produces: `export function readContract(contractPath: string): Record<string, string>`, `export function loadSharedDepDecisions(shared: Record<string, { singleton?: boolean }>, ownVersions: Record<string, string>, contractPath: string): Record<string, SharedDepDecision>`, `export function loadOwnVersions(shared: Record<string, unknown>, ownPackageJsonPath: string): Record<string, string>`

`loadOwnVersions` exists so Task 6 (`generateShareManifest`) and Task 10 (`apps/host/tsup.config.ts`) don't each duplicate the same "read own `package.json`, map dep versions" glue — both call sites need the exact same four lines otherwise.

- [ ] **Step 1: Write the failing tests**

```ts
// append to packages/share/test/shared-dep-resolver.test.ts
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { readContract, loadSharedDepDecisions } from '../src/shared-dep-resolver';

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @bridge/share test -- shared-dep-resolver`
Expected: FAIL — `readContract`/`loadSharedDepDecisions`/`loadOwnVersions` not exported

- [ ] **Step 3: Implement**

```ts
// add to packages/share/src/shared-dep-resolver.ts
import { readFileSync } from 'fs';

export function readContract(contractPath: string): Record<string, string> {
  try {
    const raw = JSON.parse(readFileSync(contractPath, 'utf-8'));
    return raw && typeof raw === 'object' ? (raw as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function loadSharedDepDecisions(
  shared: Record<string, { singleton?: boolean }>,
  ownVersions: Record<string, string>,
  contractPath: string,
): Record<string, SharedDepDecision> {
  return resolveSharedDeps(shared, ownVersions, readContract(contractPath));
}

/**
 * Reads each shared dependency's version out of a package.json's
 * `dependencies` field. Shared by generateShareManifest() (Task 6) and
 * apps/host/tsup.config.ts (Task 10) so neither duplicates this glue.
 */
export function loadOwnVersions(
  shared: Record<string, unknown>,
  ownPackageJsonPath: string,
): Record<string, string> {
  const ownPkg = JSON.parse(readFileSync(ownPackageJsonPath, 'utf-8')) as {
    dependencies?: Record<string, string>;
  };
  return Object.fromEntries(
    Object.keys(shared).map((dep) => [dep, ownPkg.dependencies?.[dep] ?? '0.0.0']),
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @bridge/share test -- shared-dep-resolver`
Expected: PASS (15 tests total)

- [ ] **Step 5: Commit**

```bash
git add packages/share/src/shared-dep-resolver.ts packages/share/test/shared-dep-resolver.test.ts
git commit -m "feat(share): read shared-dep contract from disk"
```

---

## Task 3: Extend `ShareManifest` type with `external`

**Files:**
- Modify: `packages/share/src/types.ts`

**Interfaces:**
- Produces: `ShareManifest['shared']` entries now include `external?: boolean`.

- [ ] **Step 1: Edit the type**

```ts
// packages/share/src/types.ts — change this:
export interface ShareManifest {
  name: string;
  version: string;
  baseUrl: string;
  exposes: Record<string, ShareManifestEntry>;
  shared?: Record<string, { version: string; singleton?: boolean }>;
}

// to this:
export interface ShareManifest {
  name: string;
  version: string;
  baseUrl: string;
  exposes: Record<string, ShareManifestEntry>;
  shared?: Record<string, { version: string; singleton?: boolean; external?: boolean }>;
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @bridge/share type-check`
Expected: PASS (no consumers break — `external` is optional)

- [ ] **Step 3: Commit**

```bash
git add packages/share/src/types.ts
git commit -m "feat(share): add external flag to ShareManifest.shared entries"
```

---

## Task 4: Publish `shared-dep-resolver` from the package

**Files:**
- Modify: `packages/share/package.json`
- Modify: `packages/share/tsup.config.ts`

- [ ] **Step 1: Add the export map entry**

```jsonc
// packages/share/package.json — inside "exports", after "./next-config-helper"
"./shared-dep-resolver": {
  "types": "./dist/shared-dep-resolver.d.ts",
  "import": "./dist/shared-dep-resolver.mjs",
  "require": "./dist/shared-dep-resolver.js"
}
```

- [ ] **Step 2: Add the tsup build entry**

```ts
// packages/share/tsup.config.ts — add a third object to the array
{
  entry: ['src/shared-dep-resolver.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  platform: 'node',
},
```

- [ ] **Step 3: Build and verify the output exists**

Run: `pnpm --filter @bridge/share build`
Expected: `packages/share/dist/shared-dep-resolver.js`, `.mjs`, and `.d.ts` are created

- [ ] **Step 4: Commit**

```bash
git add packages/share/package.json packages/share/tsup.config.ts
git commit -m "feat(share): publish shared-dep-resolver as a package export"
```

---

## Task 5: `generateSharedContract()` + `sharedDepsConfig()` (shell side)

**Files:**
- Modify: `packages/share/src/next-config-helper.ts`
- Create: `packages/share/test/next-config-helper.test.ts`

**Interfaces:**
- Produces: `export function generateSharedContract(config: { provides: string[]; outputPath: string; ownPackageJsonPath?: string }): Record<string, string>`, `export function sharedDepsConfig(config: { provides: string[]; outputPath: string; ownPackageJsonPath?: string })`

- [ ] **Step 1: Write the failing tests**

```ts
// packages/share/test/next-config-helper.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @bridge/share test -- next-config-helper`
Expected: FAIL — `generateSharedContract` not exported

- [ ] **Step 3: Implement**

```ts
// add to packages/share/src/next-config-helper.ts (near the top, alongside existing imports)
// existing: import { writeFileSync, mkdirSync } from 'fs';
// existing: import { join, resolve } from 'path';
import { readFileSync } from 'fs';
import { dirname } from 'path';

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
 * Next.js config wrapper for the shell app. Regenerates the shared-dep
 * contract on config evaluation and on every webpack compile, mirroring
 * shareConfig()'s pattern for share-manifest.json.
 */
export function sharedDepsConfig(config: {
  provides: string[];
  outputPath: string;
  ownPackageJsonPath?: string;
}) {
  return (nextConfig: NextConfig): NextConfig => {
    generateSharedContract(config);

    return {
      ...nextConfig,
      webpack(webpackConfig: object, ctx: object) {
        generateSharedContract(config);

        const existing = (nextConfig as { webpack?: (c: object, x: object) => object }).webpack;
        if (existing) return existing(webpackConfig, ctx);
        return webpackConfig;
      },
    };
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @bridge/share test -- next-config-helper`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/share/src/next-config-helper.ts packages/share/test/next-config-helper.test.ts
git commit -m "feat(share): add sharedDepsConfig for the consuming shell"
```

---

## Task 6: Wire real versions + decisions into `generateShareManifest()`

**Files:**
- Modify: `packages/share/src/next-config-helper.ts`
- Modify: `packages/share/test/next-config-helper.test.ts`

**Interfaces:**
- Consumes: `loadSharedDepDecisions`, `loadOwnVersions` (Task 2).
- Produces: `generateShareManifest(config: ShareConfig & { outputDir?: string; sharedContractPath?: string; ownPackageJsonPath?: string })` now writes real per-dep versions and `external` into `manifest.shared` instead of the previous hardcoded `'0.0.0'`.

- [ ] **Step 1: Write the failing tests**

```ts
// append to packages/share/test/next-config-helper.test.ts
import { generateShareManifest } from '../src/next-config-helper';

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @bridge/share test -- next-config-helper`
Expected: FAIL — current implementation always writes `version: '0.0.0'` and no `external` field

- [ ] **Step 3: Implement**

```ts
// packages/share/src/next-config-helper.ts — replace generateShareManifest with:
import { loadSharedDepDecisions, loadOwnVersions } from './shared-dep-resolver';

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
```

Note the `{ version, external, ...cfg }` field order — `cfg` (containing `singleton`) spreads last so a caller-supplied `singleton` always wins, but `cfg` never contains `version`/`external` today (`ShareConfig.shared`'s type is `Record<string, { singleton?: boolean }>`), so this is purely about future-proofing field order, not resolving an actual conflict.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @bridge/share test -- next-config-helper`
Expected: PASS (6 tests total)

- [ ] **Step 5: Run the full package test suite to check nothing else broke**

Run: `pnpm --filter @bridge/share test`
Expected: PASS — all existing suites unaffected

- [ ] **Step 6: Commit**

```bash
git add packages/share/src/next-config-helper.ts packages/share/test/next-config-helper.test.ts
git commit -m "fix(share): compute real shared-dep versions instead of hardcoded 0.0.0"
```

---

## Task 7: Shim modules for `react`, `react-dom`, `react-dom/client`

**Files:**
- Create: `packages/share/src/shims/react-shim.ts`
- Create: `packages/share/src/shims/react-dom-shim.ts`
- Create: `packages/share/src/shims/react-dom-client-shim.ts`
- Create: `packages/share/test/shims.test.ts`

**Interfaces:**
- Produces: each shim's default + named exports, read from `window.__bridgeShared`. Note `createRoot`/`hydrateRoot` live in `react-dom/client`, not `react-dom` — `button.tsx` imports `createRoot` from `'react-dom/client'`, so that exact specifier needs its own shim/alias target, not just `'react-dom'`.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/share/test/shims.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as RealReact from 'react';
import * as RealReactDOM from 'react-dom';
import * as RealReactDOMClient from 'react-dom/client';

declare global {
  interface Window {
    __bridgeShared?: Record<string, unknown>;
  }
}

describe('shims', () => {
  beforeEach(() => {
    vi.resetModules();
    window.__bridgeShared = {
      react: RealReact,
      'react-dom': RealReactDOM,
      'react-dom/client': RealReactDOMClient,
    };
  });

  it('react-shim default-exports the shared React instance', async () => {
    const shim = await import('../src/shims/react-shim');
    expect(shim.default).toBe(RealReact);
  });

  it('react-shim re-exports useState/useEffect/createElement (spot check)', async () => {
    const shim = await import('../src/shims/react-shim');
    expect(shim.useState).toBe(RealReact.useState);
    expect(shim.useEffect).toBe(RealReact.useEffect);
    expect(shim.createElement).toBe(RealReact.createElement);
  });

  it('react-shim throws a descriptive error when window.__bridgeShared.react is missing', async () => {
    window.__bridgeShared = {};
    await expect(import('../src/shims/react-shim')).rejects.toThrow('window.__bridgeShared.react');
  });

  it('react-dom-shim re-exports createPortal/flushSync/version', async () => {
    const shim = await import('../src/shims/react-dom-shim');
    expect(shim.createPortal).toBe(RealReactDOM.createPortal);
    expect(shim.flushSync).toBe(RealReactDOM.flushSync);
    expect(shim.version).toBe(RealReactDOM.version);
  });

  it('react-dom-client-shim re-exports createRoot/hydrateRoot', async () => {
    const shim = await import('../src/shims/react-dom-client-shim');
    expect(shim.createRoot).toBe(RealReactDOMClient.createRoot);
    expect(shim.hydrateRoot).toBe(RealReactDOMClient.hydrateRoot);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @bridge/share test -- shims`
Expected: FAIL — shim files don't exist

- [ ] **Step 3: Implement**

```ts
// packages/share/src/shims/react-shim.ts
// Re-exports the shell's already-loaded React instance instead of bundling a
// second copy. Only reached when apps/host/tsup.config.ts's dynamic external/
// alias wiring (Task 10) has determined this React version is compatible
// with what apps/web guarantees — see shared-dep-resolver.ts.
const react = (globalThis as { __bridgeShared?: Record<string, any> }).__bridgeShared?.react;
if (!react) {
  throw new Error(
    '@bridge/share: window.__bridgeShared.react was not available when this chunk loaded. ' +
      'Make sure <BridgeSharedDepsProvider> wraps the page before any remote component mounts.',
  );
}

export default react;
export const {
  Children,
  Component,
  Fragment,
  Profiler,
  PureComponent,
  StrictMode,
  Suspense,
  cloneElement,
  createContext,
  createElement,
  createRef,
  forwardRef,
  isValidElement,
  lazy,
  memo,
  useCallback,
  useContext,
  useDebugValue,
  useDeferredValue,
  useEffect,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  version,
} = react;
```

```ts
// packages/share/src/shims/react-dom-shim.ts
const reactDom = (globalThis as { __bridgeShared?: Record<string, any> }).__bridgeShared?.['react-dom'];
if (!reactDom) {
  throw new Error(
    '@bridge/share: window.__bridgeShared["react-dom"] was not available when this chunk loaded. ' +
      'Make sure <BridgeSharedDepsProvider> wraps the page before any remote component mounts.',
  );
}

export default reactDom;
export const { createPortal, flushSync, version } = reactDom;
```

```ts
// packages/share/src/shims/react-dom-client-shim.ts
// Separate from react-dom-shim.ts because createRoot/hydrateRoot live under
// the 'react-dom/client' subpath, not the top-level 'react-dom' export —
// button.tsx (and any exposed component using the imperative mount pattern)
// imports createRoot from 'react-dom/client' specifically.
const reactDomClient = (globalThis as { __bridgeShared?: Record<string, any> }).__bridgeShared?.[
  'react-dom/client'
];
if (!reactDomClient) {
  throw new Error(
    '@bridge/share: window.__bridgeShared["react-dom/client"] was not available when this chunk loaded. ' +
      'Make sure <BridgeSharedDepsProvider> wraps the page before any remote component mounts.',
  );
}

export default reactDomClient;
export const { createRoot, hydrateRoot } = reactDomClient;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @bridge/share test -- shims`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/share/src/shims packages/share/test/shims.test.ts
git commit -m "feat(share): add react/react-dom shim modules for externalized chunks"
```

---

## Task 8: `BridgeSharedDepsProvider`

**Files:**
- Create: `packages/share/src/bridge-shared-deps-provider.tsx`
- Create: `packages/share/test/bridge-shared-deps-provider.test.tsx`
- Modify: `packages/share/src/index.ts`

**Interfaces:**
- Produces: `export function BridgeSharedDepsProvider({ children }: { children: ReactNode }): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
// packages/share/test/bridge-shared-deps-provider.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import { BridgeSharedDepsProvider } from '../src/bridge-shared-deps-provider';

declare global {
  interface Window {
    __bridgeShared?: Record<string, unknown>;
  }
}

describe('<BridgeSharedDepsProvider>', () => {
  it('renders its children', () => {
    render(
      <BridgeSharedDepsProvider>
        <span>child</span>
      </BridgeSharedDepsProvider>,
    );
    expect(screen.getByText('child')).toBeInTheDocument();
  });

  it('publishes react, react-dom, and react-dom/client on window.__bridgeShared', () => {
    render(
      <BridgeSharedDepsProvider>
        <span>child</span>
      </BridgeSharedDepsProvider>,
    );
    expect(window.__bridgeShared?.react).toBe(React);
    expect(window.__bridgeShared?.['react-dom']).toBe(ReactDOM);
    expect(window.__bridgeShared?.['react-dom/client']).toBe(ReactDOMClient);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bridge/share test -- bridge-shared-deps-provider`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement**

```tsx
// packages/share/src/bridge-shared-deps-provider.tsx
'use client';
import { useRef, type ReactNode } from 'react';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';

declare global {
  interface Window {
    __bridgeShared?: Record<string, unknown>;
  }
}

/**
 * Publishes the shell's own React/React-DOM instances on window.__bridgeShared
 * so externalized remote chunks (see shims/*.ts) can reference the exact same
 * module instance instead of bundling their own copy. Must be mounted above
 * every usage of <RemoteComponent>/useRemoteComponent in the tree — React
 * commits a parent's render before any descendant's effects run, so this
 * assignment is guaranteed to happen before useRemoteComponent's effect fires.
 */
export function BridgeSharedDepsProvider({ children }: { children: ReactNode }) {
  const initialized = useRef(false);
  if (!initialized.current) {
    window.__bridgeShared = {
      react: React,
      'react-dom': ReactDOM,
      'react-dom/client': ReactDOMClient,
    };
    initialized.current = true;
  }
  return <>{children}</>;
}
```

```ts
// packages/share/src/index.ts — add this export
export { BridgeSharedDepsProvider } from './bridge-shared-deps-provider';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @bridge/share test -- bridge-shared-deps-provider`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/share/src/bridge-shared-deps-provider.tsx packages/share/test/bridge-shared-deps-provider.test.tsx packages/share/src/index.ts
git commit -m "feat(share): add BridgeSharedDepsProvider client component"
```

---

## Task 9: Runtime guard — `assertSharedDepsAvailable()`

**Files:**
- Create: `packages/share/src/shared-dep-guard.ts`
- Create: `packages/share/test/shared-dep-guard.test.ts`
- Modify: `packages/share/src/use-remote-component.tsx`
- Modify: `packages/share/test/use-remote-component.test.tsx`

**Interfaces:**
- Consumes: `checkVersion` from `version-check.ts`, `ShareManifest['shared']` (Task 3).
- Produces: `export function assertSharedDepsAvailable(shared: ShareManifest['shared']): void`

- [ ] **Step 1: Write the failing tests for the guard**

```ts
// packages/share/test/shared-dep-guard.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { assertSharedDepsAvailable } from '../src/shared-dep-guard';

declare global {
  interface Window {
    __bridgeShared?: Record<string, unknown>;
  }
}

describe('assertSharedDepsAvailable', () => {
  beforeEach(() => {
    window.__bridgeShared = undefined;
  });

  it('does nothing when shared is undefined', () => {
    expect(() => assertSharedDepsAvailable(undefined)).not.toThrow();
  });

  it('does nothing for deps not marked external', () => {
    expect(() =>
      assertSharedDepsAvailable({ react: { version: '18.3.0', external: false } }),
    ).not.toThrow();
  });

  it('passes when the live global exists and its version is compatible', () => {
    window.__bridgeShared = { react: { version: '18.3.1' } };
    expect(() =>
      assertSharedDepsAvailable({ react: { version: '18.3.0', external: true } }),
    ).not.toThrow();
  });

  it('throws when the global is missing entirely', () => {
    expect(() =>
      assertSharedDepsAvailable({ react: { version: '18.3.0', external: true } }),
    ).toThrow('window.__bridgeShared.react');
  });

  it('throws when the live version has drifted to an incompatible major', () => {
    window.__bridgeShared = { react: { version: '19.0.0' } };
    expect(() =>
      assertSharedDepsAvailable({ react: { version: '18.3.0', external: true } }),
    ).toThrow('Version mismatch');
  });

  it('throws when the live global has no version property', () => {
    window.__bridgeShared = { react: {} };
    expect(() =>
      assertSharedDepsAvailable({ react: { version: '18.3.0', external: true } }),
    ).toThrow('no version to verify compatibility');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @bridge/share test -- shared-dep-guard`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement the guard**

```ts
// packages/share/src/shared-dep-guard.ts
import { checkVersion } from './version-check';
import type { ShareManifest } from './types';

declare global {
  interface Window {
    __bridgeShared?: Record<string, unknown>;
  }
}

/**
 * Re-verifies, at mount time, that the shell's live shared dependencies still
 * satisfy what an externalized chunk's manifest recorded at build time. The
 * build-time decision (shared-dep-resolver.ts) is a snapshot — this guard is
 * what catches the shell having since upgraded to an incompatible version.
 * An externalized chunk has no bundled fallback, so a failure here is always
 * a hard error, surfaced through RemoteErrorBoundary — never a silent skip.
 */
export function assertSharedDepsAvailable(shared: ShareManifest['shared']): void {
  if (!shared) return;

  for (const [dep, entry] of Object.entries(shared)) {
    if (!entry.external) continue;

    const live = window.__bridgeShared?.[dep] as { version?: unknown } | undefined;
    if (!live) {
      throw new Error(
        `@bridge/share: shared dependency "${dep}" was expected at window.__bridgeShared.${dep} but is not available. ` +
          'Make sure <BridgeSharedDepsProvider> wraps this page before any remote component mounts.',
      );
    }

    if (typeof live.version !== 'string') {
      throw new Error(
        `@bridge/share: shared dependency "${dep}" is available but has no version to verify compatibility.`,
      );
    }

    checkVersion(live.version, `^${entry.version}`);
  }
}
```

- [ ] **Step 4: Run guard tests to verify they pass**

Run: `pnpm --filter @bridge/share test -- shared-dep-guard`
Expected: PASS (6 tests)

- [ ] **Step 5: Write the failing integration test in use-remote-component.test.tsx**

The file already imports `renderHook`, `waitFor`, `act` from `@testing-library/react` and mocks `../src/manifest-loader` and `../src/chunk-loader` at the top — no new imports needed. Add this as a new test inside the existing `describe('useRemoteComponent', ...)` block, after the `'sets error on version mismatch when requiredVersion is set'` test:

```tsx
it('throws a version-mismatch error when a shared dep has drifted', async () => {
  window.__bridgeShared = { react: { version: '19.0.0' } };
  vi.mocked(loadManifest).mockResolvedValue({
    ...mockManifest,
    shared: { react: { version: '18.3.0', external: true } },
  });

  const { result } = renderHook(() =>
    useRemoteComponent('http://example.com/manifest.json', './Button'),
  );

  await waitFor(() => expect(result.current.error).not.toBeNull());
  expect(result.current.error?.message).toContain('Version mismatch');
  window.__bridgeShared = undefined;
});
```

Also add the ambient declaration used by the guard's tests to the top of this file (above `describe('useRemoteComponent', ...)`), since this file now touches `window.__bridgeShared` directly:

```ts
declare global {
  interface Window {
    __bridgeShared?: Record<string, unknown>;
  }
}
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm --filter @bridge/share test -- use-remote-component`
Expected: FAIL — `useRemoteComponent` doesn't check `manifest.shared` yet, so no error is thrown

- [ ] **Step 7: Wire the guard into `useRemoteComponent`**

```ts
// packages/share/src/use-remote-component.tsx
// add import:
import { assertSharedDepsAvailable } from './shared-dep-guard';

// inside the .then((manifest) => { ... }) callback, after the existing
// `if (requiredVersion) checkVersion(entry.version, requiredVersion);` line
// and before `const chunkUrl = ...`, add:
assertSharedDepsAvailable(manifest.shared);
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `pnpm --filter @bridge/share test -- use-remote-component`
Expected: PASS

- [ ] **Step 9: Run the full suite**

Run: `pnpm --filter @bridge/share test`
Expected: PASS — everything green

- [ ] **Step 10: Commit**

```bash
git add packages/share/src/shared-dep-guard.ts packages/share/test/shared-dep-guard.test.ts packages/share/src/use-remote-component.tsx packages/share/test/use-remote-component.test.tsx
git commit -m "feat(share): guard externalized chunks against shared-dep drift at mount time"
```

---

## Task 10: Dynamic `alias` in `apps/host/tsup.config.ts`

**Files:**
- Modify: `apps/host/tsup.config.ts`

**Interfaces:**
- Consumes: `loadSharedDepDecisions`, `loadOwnVersions` from `@bridge/share/shared-dep-resolver` (Task 4).

**Important correction vs. the spec's illustrative sketch:** only `esbuildOptions.alias` should vary by decision. `noExternal` must stay exactly as today (`[/react/]`) regardless of the decision. Reasoning: esbuild's `external` leaves an import specifier completely unresolved in the output (which would require an import map for the browser to resolve the bare `"react"` specifier at runtime — not part of this design). `alias` instead redirects module *resolution* — when compatible, `'react'` resolves to the shim file (which then gets normally bundled, since it's tiny); when incompatible, no alias is set and normal `node_modules` resolution finds the real `react` package, which also gets normally bundled (today's behavior, unchanged). `noExternal: [/react/]` is what forces tsup to bundle *whatever these specifiers resolve to* rather than leaving them as tsup's usual default of "external because it's a package.json dependency" — that part of the behavior is identical whether or not the alias is active, so it never needs to change.

- [ ] **Step 1: Implement**

```ts
// apps/host/tsup.config.ts
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
```

- [ ] **Step 2: Verify the fallback path (no contract file yet) still bundles everything, unchanged**

Run: `pnpm --filter host build:chunks`
Expected: succeeds, and `apps/host/public/button.chunk.js` still contains a bundled React (identical to before this plan started) — `packages/share/shared-contract.json` doesn't exist yet at this point in the plan (created in Task 11), so `loadSharedDepDecisions` falls back to `external: false` for everything and no alias is set.

- [ ] **Step 3: Commit**

```bash
git add apps/host/tsup.config.ts
git commit -m "feat(host): alias react/react-dom to shared-dep shims when compatible"
```

---

## Task 11: Wire the shell and exposing app configs together

**Files:**
- Modify: `apps/web/next.config.ts`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/host/next.config.ts`

- [ ] **Step 1: Declare what apps/web provides**

```ts
// apps/web/next.config.ts
import type { NextConfig } from 'next';
import { sharedDepsConfig } from '@bridge/share/next-config-helper';

const nextConfig: NextConfig = {
  transpilePackages: ['@bridge/lazy-handler', '@bridge/hydration'],
};

export default sharedDepsConfig({
  provides: ['react', 'react-dom'],
  outputPath: '../../packages/share/shared-contract.json',
})(nextConfig);
```

- [ ] **Step 2: Publish the shared globals from the root layout**

```tsx
// apps/web/app/layout.tsx
import type { Metadata } from 'next';
import { BridgeSharedDepsProvider } from '@bridge/share';
import './globals.css';

export const metadata: Metadata = {
  title: '@bridge demos',
  description: 'Demo app for @bridge/lazy-handler, @bridge/hydration, and @bridge/share',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <BridgeSharedDepsProvider>{children}</BridgeSharedDepsProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Declare what apps/host shares, and where to check compatibility**

```ts
// apps/host/next.config.ts
import type { NextConfig } from 'next';
import { shareConfig } from '@bridge/share/next-config-helper';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(share-manifest\\.json|.*\\.chunk\\.js)',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'http://localhost:3000' },
          { key: 'Access-Control-Allow-Methods', value: 'GET' },
        ],
      },
    ];
  },
};

export default shareConfig({
  name: 'host-app',
  version: '1.0.0',
  baseUrl: 'http://localhost:3001',
  exposes: {
    './Button': './src/components/button.tsx',
  },
  shared: { react: {}, 'react-dom': {} },
  sharedContractPath: '../../packages/share/shared-contract.json',
})(nextConfig);
```

- [ ] **Step 4: Type-check both apps**

Run: `pnpm --filter host type-check && pnpm --filter web type-check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/next.config.ts apps/web/app/layout.tsx apps/host/next.config.ts
git commit -m "feat: wire shell and exposing app configs for shared-dep externalization"
```

---

## Task 12: Build ordering + end-to-end verification

**Files:**
- Modify: `turbo.json`

- [ ] **Step 1: Ensure apps/host's build waits on apps/web's build**

`apps/host` doesn't depend on `apps/web` in `package.json` (they're sibling apps, not package dependencies), so turbo's default `"dependsOn": ["^build"]` won't order them relative to each other — but `apps/host`'s build now needs `packages/share/shared-contract.json` to exist and be current, and that file is only written as a side effect of evaluating `apps/web`'s Next config (Task 11, Step 1). Add an explicit override:

```jsonc
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**", "!dist/**/*.map"]
    },
    "host#build": {
      "dependsOn": ["^build", "web#build"],
      "outputs": [".next/**", "dist/**", "!dist/**/*.map"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "type-check": {
      "dependsOn": ["^type-check"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    }
  }
}
```

If the contract is still missing or stale for some other reason (e.g. running `pnpm --filter host build` in isolation without ever building `web`), `loadSharedDepDecisions` already falls back to `external: false` — a missing contract is a safe no-op, not a build failure (Global Constraints).

- [ ] **Step 2: Full clean build from the repo root**

Run: `pnpm build`
Expected: `apps/web`'s build runs (and via its `webpack`/config-eval side effect, `packages/share/shared-contract.json` is written) before `apps/host`'s build runs.

- [ ] **Step 3: Confirm the contract file was written with real versions**

Run: `cat packages/share/shared-contract.json`
Expected: `{ "react": "^18.3.0", "react-dom": "^18.3.0" }` (or whatever `apps/web/package.json` currently pins)

- [ ] **Step 4: Confirm the manifest recorded external:true for both deps**

Run: `cat apps/host/public/share-manifest.json`
Expected: `shared.react.external` and `shared["react-dom"].external` are both `true` (since `apps/host` and `apps/web` currently both pin `^18.3.0` for both deps — same major, same minor, compatible)

- [ ] **Step 5: Confirm the chunk no longer bundles React**

Run: `grep -c "useState" apps/host/public/button.chunk.js`
Expected: a small number (only whatever the shim/host's own code references), not the hundreds of matches a full bundled React copy would produce. Cross-check file size: `ls -la apps/host/public/button.chunk.js` should be noticeably smaller than it was before this plan (check via `git show HEAD~12:apps/host/public/button.chunk.js | wc -c` for a rough before/after byte count, adjusting `~12` to however many commits this plan added by that point).

- [ ] **Step 6: Manual smoke test in the browser**

Run: `pnpm dev` (starts both apps via turbo)
Then: open `http://localhost:3000/demo/share`, open DevTools Network tab, confirm `button.chunk.js` loads and the button renders and responds to clicks (same behavior as before), and confirm no console error about `window.__bridgeShared`.

- [ ] **Step 7: Commit**

```bash
git add turbo.json
git commit -m "build: order apps/host's build after apps/web's to keep shared-dep contract fresh"
```

---

## Post-plan follow-ups (not part of this plan, noted for later)

- Extending `provides`/`shared` beyond `react`/`react-dom` requires hand-writing a new shim per dependency (see spec's "Shim named-export drift" risk) — there's no generic mechanism for arbitrary packages.
- If `apps/host` and `apps/web` ever become separately deployed/repos, `shared-contract.json` needs to become fetch-based (mirroring `manifest-loader.ts`'s HTTP fetch of `share-manifest.json`) instead of a local filesystem read.
