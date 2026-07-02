
# Build-Time Shared Dependency Externalization for `@bridge/share`

> Spec date: 2026-07-01 · Status: proposed, not yet implemented

## Terminology note

Standard Webpack Module Federation vocabulary calls the consuming/mounting app the **"Host"** and each exposing app a **"Remote."** This repo's folder names are the opposite: `apps/host` is the *exposing* app (it has `exposes`, builds `.chunk.js` files via tsup) and `apps/web` is the *consuming* app (it calls `useRemoteComponent`). To avoid ambiguity, this spec uses the repo's actual folder names (`apps/host`, `apps/web`) everywhere instead of "host"/"remote," except where quoting prior discussion.

## Motivation

`@bridge/share` currently loads each exposed component as a fully self-contained chunk. `apps/host/tsup.config.ts` forces this today via `noExternal: [/react/]`, with the explicit rationale (in `chunk-loader.ts`) that each app should own its own React root to avoid dual-React-instance element-identity bugs.

This is safe but wasteful in the common case: `apps/web` mounts exposed components directly into its own page (via `mount(container, props)`), not inside an iframe or separate document. It already has its own React instance running on that page. When an exposed chunk's bundled React version is compatible with what `apps/web` already has loaded, shipping a second full copy of React/ReactDOM inside every chunk is pure duplicate download weight with no isolation benefit — the "dual instance" hazard the current design avoids only applies when two genuinely different React copies coexist, not when a chunk is made to reference the exact same instance already on the page.

**Goal:** when `apps/host`'s own dependency version is compatible with what `apps/web` guarantees it will provide, exclude that dependency from the chunk build and have the chunk reference `apps/web`'s already-loaded copy at runtime instead. When incompatible, fall back to today's behavior (bundle it in) with zero behavior change.

This is deliberately **not** a general reimplementation of Webpack Module Federation's runtime shared-scope negotiation. The compatibility decision is made once, at `apps/host`'s build time, against a static contract — not renegotiated per page load. This trades some resilience to version drift (mitigated by a runtime guard, see below) for significantly less complexity: no runtime module registry, no per-session negotiation, and it fits entirely within the existing tsup/esbuild build step, which is already decoupled from Next's Turbopack pipeline and fully supports static `external` configuration.

## Goals

- Reduce duplicate dependency bytes downloaded per exposed component, for dependencies both sides agree are compatible.
- Keep the decision static and build-time only; no runtime version negotiation.
- Preserve today's behavior exactly as the fallback path when versions are incompatible or the contract is unavailable.
- Fail loudly (via the existing error boundary), never silently, if a runtime mismatch is detected despite a build-time "compatible" decision.

## Non-goals

- Supporting exposing apps and the consuming shell living in separate repos/deployments with no shared filesystem (would require a fetch-based contract instead of a locally-read file; noted as a future extension, not built here).
- Runtime renegotiation or dual-variant (bundled + externalized) chunk builds selected at load time.
- Sharing dependencies across chunks mounted into different pages/origins (this only works because `apps/web` and the mounted component share one page/JS realm).

## Architecture

```
apps/web (consumer/shell)                    apps/host (exposing app)
─────────────────────────                    ────────────────────────
next.config.ts                               tsup.config.ts (build time)
  sharedDepsConfig({                            1. read shared-contract.json
    provides: ['react','react-dom']              2. read own package.json versions
  })                                             3. resolveSharedDeps() → per-dep
    │                                               { external: boolean }
    ▼                                            4. build with dynamic `external`
  writes                                            + shim aliasing for externalized deps
  packages/share/shared-contract.json           5. generateShareManifest() records
    { "react": "18.3.1",                           shared.<dep>.external per component
      "react-dom": "18.3.1" }
                                               chunk file (e.g. button.chunk.js)
app/layout.tsx (runtime, once)                  - externalized deps: import from shim
  window.__bridgeShared = {                       (re-exports window.__bridgeShared.<dep>)
    react: React,                                 - incompatible deps: bundled as today
    'react-dom': ReactDOM,
  }
                                               ▼
                                        share-manifest.json
                                          exposes: { './Button': {...} }
                                          shared: { react: { version, external: true } }

                          runtime (apps/web, on demand)
                          ──────────────────────────────
                          useRemoteComponent() → loadManifest()
                            → for each shared dep marked external:
                                verify window.__bridgeShared[dep] exists
                                and satisfies the same compatibility rule
                            → loadChunk(url) → mount(container, props)
                            → on guard failure: surface via
                              remote-error-boundary.tsx, do not mount
```

## Components

### 1. `sharedDepsConfig()` — new, in `packages/share/src/next-config-helper.ts`

Called from `apps/web/next.config.ts`, symmetric to the existing `shareConfig()`:

```ts
// apps/web/next.config.ts
import { sharedDepsConfig } from '@bridge/share/next-config-helper';

export default sharedDepsConfig({
  provides: ['react', 'react-dom'],
})(nextConfig);
```

Behavior:
- For each name in `provides`, reads the installed version from `apps/web/package.json` (resolved via Node's module resolution at build time, same approach `next-config-helper.ts` already uses for reading local config).
- Writes `packages/share/shared-contract.json`:
  ```json
  { "react": "18.3.1", "react-dom": "18.3.1" }
  ```
- Regenerates on every config evaluation and every webpack/dev compile, same pattern `shareConfig()` already follows for `share-manifest.json`.
- `provides` is an explicit, authored list — not auto-derived from scanning all of `package.json`'s dependencies. `apps/web` may depend on many packages it never intends to expose as a shared runtime global; only what's explicitly listed is trustworthy to externalize against.

### 2. `resolveSharedDeps()` — new, in `packages/share/src/shared-dep-resolver.ts`

Pure function, called from `apps/host/tsup.config.ts` before build:

```ts
export interface SharedDepDecision {
  external: boolean;
  ownVersion: string;
  contractVersion?: string;
}

export function resolveSharedDeps(
  shared: Record<string, { singleton?: boolean }>,
  ownVersions: Record<string, string>,
  contract: Record<string, string>,
): Record<string, SharedDepDecision>
```

Compatibility rule (reuses the semver parsing already in `version-check.ts`): compatible when `ownVersion.major === contractVersion.major && ownVersion.minor <= contractVersion.minor`. `apps/host`'s own version must be *no newer* than what `apps/web` provides — `apps/web`'s copy is what actually ends up running, so it must be at least as new as what the exposed component was built and tested against. If the contract file is missing, unreadable, or doesn't list a given dep, that dep resolves to `external: false` (safe fallback, identical to today).

### 3. Dynamic tsup config — `apps/host/tsup.config.ts`

Replaces the static `noExternal: [/react/]` with a per-dep decision:

```ts
import { resolveSharedDeps } from '@bridge/share/shared-dep-resolver';
import contract from '../../packages/share/shared-contract.json';
import pkg from './package.json';

const decisions = resolveSharedDeps(
  { react: {}, 'react-dom': {} }, // from ShareConfig.shared, see next-config-helper usage
  { react: pkg.dependencies.react, 'react-dom': pkg.dependencies['react-dom'] },
  contract,
);

export default defineConfig({
  // ...
  external: Object.entries(decisions)
    .filter(([, d]) => d.external)
    .map(([name]) => name),
  noExternal: Object.entries(decisions)
    .filter(([, d]) => !d.external)
    .map(([name]) => new RegExp(name)),
  esbuildOptions(options) {
    options.alias = {
      ...options.alias,
      ...(decisions.react?.external ? { react: '@bridge/share/shims/react-shim' } : {}),
      ...(decisions['react-dom']?.external ? { 'react-dom': '@bridge/share/shims/react-dom-shim' } : {}),
    };
  },
});
```

### 4. Shim modules — new, `packages/share/src/shims/react-shim.ts`, `react-dom-shim.ts`

Each shim re-exports the page-level global instead of the real package, matching React's actual named-export surface:

```ts
// react-shim.ts
const react = (globalThis as any).__bridgeShared?.react;
if (!react) throw new Error('@bridge/share: window.__bridgeShared.react not available — shell did not publish it before this chunk loaded');
export default react;
export const { useState, useEffect, useRef, useMemo, useCallback, useContext, createElement, Fragment, createContext } = react;
```

A test asserts this named-export list matches `Object.keys(require('react'))` for the pinned React version, so a future React upgrade that adds/removes exports fails the test suite instead of failing silently at runtime in a consumer app.

### 5. Manifest annotation — `generateShareManifest()`

Extends the existing `shared` field (already present in `types.ts`) to record the actual decision, not just the declared intent:

```json
{
  "shared": {
    "react": { "version": "18.3.0", "singleton": true, "external": true }
  }
}
```

### 6. Shell-side runtime bootstrap — `apps/web/app/layout.tsx`

```ts
if (typeof window !== 'undefined') {
  (window as any).__bridgeShared = { react: React, 'react-dom': ReactDOM };
}
```

Must run before the first `useRemoteComponent()` call can resolve. Since this is a synchronous module-level assignment in the root layout (which renders before any page content, including any component that could call `useRemoteComponent`), ordering is guaranteed within `apps/web`'s own render — no async race exists as long as this stays in a layout/root-level module rather than a lazy-loaded one.

### 7. Runtime guard — `chunk-loader.ts` / `remote-component.tsx`

Before calling `loadChunk(url)` for a manifest entry with any `shared.<dep>.external === true`:
- Check `window.__bridgeShared?.[dep]` exists.
- Re-run the same compatibility check against `window.__bridgeShared[dep].version` (React exposes `.version`) vs. the manifest's declared `shared.<dep>.version`, catching drift between `apps/host`'s last build and `apps/web`'s currently-running version.
- On failure: throw a descriptive error, caught by the existing `remote-error-boundary.tsx`. There is no bundled fallback available in an externalized chunk, so this is necessarily a hard failure, not a silent degrade — this must be called out to consumers of `@bridge/share` in its docs, since it changes the failure mode versus today (today, a manifest/version mismatch is caught by `version-check.ts` before mount; here, an *additional* mismatch class becomes possible: the shell's live version drifting from what the chunk's build-time contract snapshot assumed).

## Data flow summary

**Build time:** `apps/web` build writes the contract → `apps/host` build reads it, decides per-dep externalization, builds the chunk accordingly, and records the decision in the manifest.

**Runtime:** `apps/web` boots and publishes `window.__bridgeShared` → a component calls `useRemoteComponent()` → manifest is fetched → for each externalized dep, the guard verifies the shell's live global still satisfies the contract → chunk is imported (referencing the shell's React instance for externalized deps, bundling its own copy for anything incompatible) → `mount()` is invoked as today.

## Error handling

| Condition | Behavior |
|---|---|
| Contract file missing/unreadable at `apps/host` build time | Treat as incompatible; bundle the dep (today's behavior), no build failure |
| Dep not listed in contract | Same — bundle it, no build failure |
| Versions incompatible (major differs, or `apps/host`'s minor is newer than the shell's) | Bundle it (today's behavior) |
| `window.__bridgeShared[dep]` missing at runtime despite manifest saying `external: true` | Hard error surfaced through `remote-error-boundary.tsx`; component does not mount |
| `window.__bridgeShared[dep]` present but its live version no longer satisfies the manifest's recorded version at runtime | Same hard error path — this is the drift-detection case |

## Testing

- `shared-dep-resolver.test.ts`: unit tests for `resolveSharedDeps()` covering exact match, compatible minor gap, incompatible major, missing contract entry, missing contract file — mirrors the structure of the existing `version-check.test.ts`.
- Shim named-export parity test: asserts `react-shim.ts`'s re-exported names match the real `react` package's exports for the pinned version.
- `remote-component.test.tsx`: new cases for the runtime guard — externalized dep present & compatible (mounts normally), missing (error boundary triggers), present but drifted version (error boundary triggers).
- Integration smoke test (manual, via the existing `apps/host` + `apps/web` dev setup): confirm `button.chunk.js`'s network payload shrinks when React is externalized, and confirm the component still mounts and functions correctly in `apps/web`.

## Risks and mitigations

- **Build-time snapshot can go stale.** If `apps/web` upgrades React after `apps/host`'s last build, the chunk may have been built assuming a version that's no longer accurate. Mitigated by the mandatory runtime guard (section 7) — this is why that guard is not optional/skippable in the design.
- **Global mutable state (`window.__bridgeShared`).** A page-level global is inherently a bit fragile compared to a scoped mechanism. Scoped to a single, clearly-named object rather than scattering globals per-dependency, and guarded by existence checks everywhere it's read.
- **Shim named-export drift.** If React adds/removes named exports across versions and the shim isn't updated, consumers get a runtime `undefined` error instead of a build-time failure. Mitigated by the parity test in the Testing section.
- **Scope creep to arbitrary deps.** The mechanism generalizes to any dep in principle, but each new shared dependency needs its own hand-written shim (there's no way to generically re-export "whatever a package's named exports are" without knowing them ahead of time). This repo starts with only `react` and `react-dom` shimmed; adding more is manual, deliberate work, not automatic.

## Future extensions (not built now)

- Fetch-based contract (instead of reading `shared-contract.json` off the local filesystem) if `apps/host` and `apps/web` ever become independently deployed/repos, mirroring how `manifest-loader.ts` already fetches `share-manifest.json` over HTTP.
- Dual-variant chunk builds (bundled + externalized) selected at runtime based on the shell's actually-detected version, for cases where the static build-time snapshot proves too brittle in practice.
