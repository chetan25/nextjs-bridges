# @bridge Monorepo — Implementation Action Plan

> Spec version: `bridge-cursor-spec.docx` v0.1.0-alpha · Plan date: 2026-06-29

---

## Overview

Three composable libraries targeting Next.js 15 + Turbopack, filling the gaps left by the removal of Webpack Module Federation and the lack of declarative hydration/handler-deferral APIs.

| Library | Purpose | Key primitive |
|---------|---------|---------------|
| `@bridge/lazy-handler` | Defer event handler JS until first interaction | `useLazyHandler()` hook |
| `@bridge/hydration` | Control when a Client Component hydrates | `<HydrationBoundary>` |
| `@bridge/share` | Runtime cross-app component sharing | `useRemoteComponent()` + manifest |

---

## Phase 0: Monorepo Scaffold _(do this first)_

> The spec jumps straight to Phase 1. In practice the toolchain must be in place before any package code is written.

### 0.1 — Workspace init

```
monorepo-root/
  apps/
    web/          ← Next.js 15 demo/integration app
    host/         ← Second app for @bridge/share cross-app tests  ← IMPROVEMENT: spec has one app
  packages/
    lazy-handler/
    hydration/
    share/
    tsconfig/     ← IMPROVEMENT: shared tsconfig base package
  .changeset/     ← IMPROVEMENT: changesets for versioning
  pnpm-workspace.yaml
  turbo.json
  package.json
```

**Tasks:**
- [ ] `pnpm init` at root, set `"private": true`
- [ ] Create `pnpm-workspace.yaml` with `apps/*` and `packages/*`
- [ ] Add root `package.json` devDependencies: `turbo`, `typescript`, `@changesets/cli`, `eslint`, `prettier`, `vitest`, `@playwright/test`, `msw`
- [ ] Create `packages/tsconfig/` with `base.json` (strict mode **on from day one** — spec defers this to Phase 4, which causes expensive type-fix sprints late)
- [ ] Create `turbo.json` (copy from spec, add `lint` and `test` tasks)
- [ ] Set up `.eslintrc` (flat config) + `prettier.config.js` at root
- [ ] Set up `tsup` config template for packages (spec is silent on build tooling)
- [ ] Add GitHub Actions CI: `.github/workflows/ci.yml` — runs `lint`, `type-check`, `test`, `build` on push/PR

### 0.2 — Shared tsconfig base

```jsonc
// packages/tsconfig/base.json
{
  "compilerOptions": {
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

### 0.3 — Changeset init

```bash
pnpm changeset init
```

Docs: each PR that changes a package ships with a `.changeset` file → automated `CHANGELOG.md` + npm version bumps.

---

## Phase 1: `@bridge/lazy-handler`

### Spec tasks (unchanged)

- [ ] Scaffold `packages/lazy-handler/` with `package.json`, `tsconfig.json`, `tsup.config.ts`
- [ ] Implement `useLazyHandler` hook (`src/use-lazy-handler.ts`)
- [ ] Implement `<Interactive>` component (`src/interactive.tsx`)
- [ ] Implement `withLazyHandlers` HOC (`src/hoc.tsx`)
- [ ] Unit tests — vitest + jsdom
- [ ] Integration test — Playwright in `apps/web`

### Improvements & fixes

#### Fix 1 — `<Interactive>` wraps in a `<div>`, breaking inline/table contexts

The spec's implementation always renders `<div ref={ref}>`. This will break inside `<tr>`, `<ul>`, button groups, and inline text.

**Improvement:** Accept an `as` prop (polymorphic element) and default to `React.Fragment` when possible, falling back to `span`.

```tsx
// proposed signature
<Interactive
  as="span"               // default: 'span' not 'div'
  on={{ click: () => import('./handler') }}
>
  <button>Click me</button>
</Interactive>
```

#### Fix 2 — Event re-dispatch can lose synthetic React event data

The spec calls `mod.default(e)` with the original DOM event after loading the handler. For events like `onSubmit` or `onChange`, the original event's `target.value` may still be valid, but form submission state may have already propagated. For `onClick`, this is fine.

**Improvement:** In `useLazyHandler`, clone the event before the async gap:

```ts
// Capture relevant data synchronously before the async import
const eventSnapshot = { type: e.type, target: e.target, currentTarget: e.currentTarget };
loaderRef.current().then(mod => mod.default(e, eventSnapshot));
```

#### Fix 3 — Multiple events in `<Interactive>` — only `click` is wired

The `InteractiveProps.on` interface accepts `click` and `change`, but the component body only calls `useLazyHandler` for `on.click`. `on.change` is silently ignored.

**Improvement:** Call `useLazyHandler` per event key and merge refs (use `useCallback` ref or a ref-merging utility).

#### Fix 4 — Loader reference stability

The spec creates `loaderRef` to avoid stale-closure issues, but the `stub` callback is in `useCallback([])` while reading `loaderRef`. This is correct. Document it explicitly in tests to prevent regressions when the hook is refactored.

#### Improvement: AbortController on unmount

When the component unmounts between the interaction and the `import()` resolution, calling `setState` on unmounted component is a no-op in React 18 but logs a warning. Wrap the loader with an abort guard:

```ts
useEffect(() => {
  let cancelled = false;
  // ...existing setup...
  return () => { cancelled = true; el.removeEventListener(event, stub); };
}, [...]);
```

#### Improvement: `preloadOn: 'visible'` option

The spec offers `hover | focus | none`. Add `visible` (IntersectionObserver) so the handler preloads as soon as the element is in the viewport — a common pattern for above-fold CTAs that are rendered but not yet clicked.

#### Additional tests to write

| Test | Why |
|------|-----|
| Handler called only once even on rapid clicks | Guards against double-load race |
| `preloadOn='hover'` prefetches before click | Verifies preload path |
| Unmount before load completes — no error | Guards memory leak / setState warning |
| `withLazyHandlers` HOC passes through all other props | Regression guard |

---

## Phase 2: `@bridge/hydration`

### Spec tasks (unchanged)

- [ ] Scaffold `packages/hydration/`
- [ ] Implement `HydrationBoundary` — `eager` + `visible` strategies
- [ ] Add `idle` strategy
- [ ] Add `interaction` strategy
- [ ] Add `manual` strategy + `useHydrationState`
- [ ] Add `withHydrationBoundary` HOC
- [ ] Integration test in Playwright

### Improvements & fixes

#### Fix 1 — `useHydrationState` / `hydrateNow` not wired to `manual` strategy

The spec defines `useHydrationState(): { hydrated, hydrateNow }` and the `manual` strategy, but the `HydrationBoundary` implementation in the spec never calls `hydrateNow` internally — the component always sets `hydrated` via local `useState`, making `hydrateNow` unreachable from outside.

**Improvement:** Use a `Context` to expose `hydrateNow` to descendants, and accept an optional `onHydrate` callback prop:

```tsx
const HydrationContext = React.createContext<{ hydrateNow: () => void } | null>(null);

export function useHydrationState() {
  return React.useContext(HydrationContext) ?? { hydrateNow: () => {}, hydrated: false };
}
```

#### Fix 2 — `requestIdleCallback` return type mismatch

`requestIdleCallback` returns a number, but `cancelIdleCallback` is called with `id as number` while `setTimeout` also returns a number — this works but the spec's `id` type is `number | NodeJS.Timeout`. Be explicit:

```ts
let id: ReturnType<typeof setTimeout>;
```

#### Fix 3 — `interaction` strategy event listener leak on unmount

The spec's cleanup returns an arrow function but references `ref.current` inside it. In React strict mode (double-invoke), `ref.current` may already be null during cleanup. Capture the element:

```ts
const el = ref.current;
if (!el) return;
events.forEach(ev => el.addEventListener(ev, trigger, { once: true }));
return () => events.forEach(ev => el.removeEventListener(ev, trigger));
```

#### Improvement: SSR fallback renders as a semantic wrapper

The spec's outer `<div ref={ref}>` is always rendered. On the server this becomes a meaningless wrapper. Add an `as` prop (same pattern as `<Interactive>`) and default to `React.Fragment` for SSR, switching to the real element client-side.

#### Improvement: `onHydrate` callback prop

Allow parent components to react when hydration triggers (e.g., to fire an analytics event):

```tsx
<HydrationBoundary strategy="visible" onHydrate={() => track('section_hydrated')}>
```

#### Improvement: `threshold` array support for `visible`

`IntersectionObserver` already accepts `threshold: number | number[]`. Pass it through instead of forcing a single value.

#### Improvement: `once` option

Default `HydrationBoundary` to one-way (once hydrated, stay hydrated). But for dev/testing, add a `__resetOnHide` debug prop that reverts to the fallback when the element leaves the viewport. Gated behind `process.env.NODE_ENV === 'development'`.

#### Additional tests to write

| Test | Why |
|------|-----|
| Server render produces fallback HTML | Confirms SSR correctness |
| `visible` triggers at correct scroll position | Playwright scroll test |
| `manual` with `hydrateNow()` imperative call | Tests the wiring fix above |
| Nesting two `HydrationBoundary` components | No context collision |

---

## Phase 3: `@bridge/share`

### Spec tasks (unchanged)

- [ ] Scaffold `packages/share/`
- [ ] Implement `manifest-loader.ts` with fetch + Map cache
- [ ] Implement `version-check.ts`
- [ ] Implement `useRemoteComponent` hook
- [ ] Implement `<RemoteComponent>` wrapper
- [ ] Implement `next-config-helper.ts` (writes `share-manifest.json` to `/public`)
- [ ] Integration test: `apps/host` exposes a Button, `apps/web` consumes it

### Improvements & fixes

#### Fix 1 — `turbopackIgnore` comment is required but can't be in a dynamic expression

The spec writes:
```ts
return import(/* turbopackIgnore: true */ chunkUrl);
```

The `chunkUrl` is a runtime string. Turbopack (and Webpack) **cannot statically analyze a dynamic import with a fully runtime string** — the magic comment suppresses the warning, but the chunk will not be bundled and must be served pre-built by the host. This is the correct behaviour for `@bridge/share`, but must be clearly documented and tested. Add a build-time warning if `chunkUrl` is detected as a relative path (which would break).

#### Fix 2 — No AbortController on manifest fetch

If the component unmounts during the `fetch()` call, the fetch completes and tries to set state on an unmounted component.

```ts
export function loadManifest(url: string, signal?: AbortSignal): Promise<ShareManifest> {
  if (cache.has(url)) return cache.get(url)!;
  const req = fetch(url, { signal })
    .then(r => { if (!r.ok) throw new Error(`Manifest fetch failed: ${url}`); return r.json(); })
    .then(validateManifest);
  cache.set(url, req);
  return req;
}
```

In `useRemoteComponent`, pass an `AbortController` signal.

#### Fix 3 — Singleton enforcement is described but not implemented

The spec notes "enforcement is manual for now." This is a critical correctness issue — two React instances in one page break hooks. 

**Improvement for v0.2:** On manifest load, check `shared.react.singleton === true` and compare the loaded module's React version against `window.__BRIDGE_SHARED_REACT__`. If already registered, skip the bundled React and use the shared instance. Stub this as a `TODO` comment in v0.1 so it's not forgotten.

#### Fix 4 — `validateManifest` is referenced but not defined in the spec

Add a minimal Zod (or hand-rolled) validator:

```ts
function validateManifest(raw: unknown): ShareManifest {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid manifest: not an object');
  const m = raw as Record<string, unknown>;
  if (typeof m.name !== 'string') throw new Error('Invalid manifest: missing name');
  if (typeof m.baseUrl !== 'string') throw new Error('Invalid manifest: missing baseUrl');
  if (typeof m.exposes !== 'object') throw new Error('Invalid manifest: missing exposes');
  return m as unknown as ShareManifest;
}
```

#### Improvement: Stale-while-revalidate cache

The current `Map` cache loads the manifest once per page load forever. For long-lived SPAs, add a TTL:

```ts
const cache = new Map<string, { promise: Promise<ShareManifest>; fetchedAt: number }>();
const MANIFEST_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function loadManifest(url: string): Promise<ShareManifest> {
  const entry = cache.get(url);
  if (entry && Date.now() - entry.fetchedAt < MANIFEST_TTL_MS) return entry.promise;
  const promise = fetch(url).then(r => r.json()).then(validateManifest);
  cache.set(url, { promise, fetchedAt: Date.now() });
  return promise;
}
```

#### Improvement: Retry with exponential backoff

CDN blips are common. Add configurable retry logic in `manifest-loader.ts`:

```ts
async function fetchWithRetry(url: string, retries = 3, signal?: AbortSignal): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try { return await fetch(url, { signal }); }
    catch (e) { if (i === retries - 1 || signal?.aborted) throw e; await sleep(200 * 2 ** i); }
  }
  throw new Error('unreachable');
}
```

#### Improvement: `<RemoteComponent>` error boundary

The spec has no error handling in `<RemoteComponent>` beyond `state.error`. Wrap in a React Error Boundary so a failed remote component doesn't crash the host app:

```tsx
export function RemoteComponent({ manifest, expose, fallback, errorFallback, props }) {
  return (
    <RemoteErrorBoundary fallback={errorFallback ?? <DefaultError />}>
      <RemoteComponentInner manifest={manifest} expose={expose} fallback={fallback} props={props} />
    </RemoteErrorBoundary>
  );
}
```

#### Improvement: `next-config-helper.ts` — generate manifest at build time

The spec says `createShareManifest()` "writes to /public" but doesn't say when. Wire it as a Next.js plugin so it runs during `next build`:

```ts
// next.config.ts
import { shareConfig } from '@bridge/share/next-config-helper';
export default shareConfig({ exposes: { './Button': './src/components/Button.tsx' } })(nextConfig);
```

The plugin should hook into `webpack` (for Next.js non-Turbopack builds) or a `postBuild` script. Since Turbopack doesn't expose a plugin API, generate the manifest as a `prebuild` npm script instead — document this clearly.

#### Security consideration: CSP

Loading arbitrary JS chunks from external origins requires `script-src` CSP entries. Add a section to the `@bridge/share` README listing the required CSP headers and provide a Next.js `headers()` config snippet.

#### Additional tests to write

| Test | Why |
|------|-----|
| Manifest fetch failure shows `error` state | Error path |
| Version mismatch throws a clear error | `version-check.ts` |
| `bustManifestCache` forces re-fetch | Cache invalidation |
| Two consumers of the same manifest share one fetch | Cache dedup |
| AbortController cancels in-flight fetch on unmount | Memory/network hygiene |

---

## Phase 4: Demo App (`apps/web`)

> Spec calls this "Polish." It's more useful as an integration harness built alongside each phase.

- [ ] Next.js 15 App Router setup in `apps/web`
- [ ] Demo page: `app/demo/lazy-handler/page.tsx` — heavy button handler deferred
- [ ] Demo page: `app/demo/hydration/page.tsx` — all 5 strategies visible on one page with strategy selector
- [ ] Demo page: `app/demo/share/page.tsx` — loads a `Button` from `apps/host`
- [ ] Add `apps/host` — second Next.js app with `share-manifest.json` published

### Improvement: Lighthouse CI on demo app

Add `@lhci/cli` to CI. Run Lighthouse against `apps/web` in CI and fail if:
- TBT (Total Blocking Time) regresses more than 50ms
- LCP regresses more than 200ms

This proves the libraries actually improve performance, not just theoretically.

---

## Phase 5: Polish & Release Prep _(spec's Phase 4)_

- [ ] TypeScript strict mode on all packages (already done via `packages/tsconfig/base.json`)
- [ ] JSDoc on all public exports
- [ ] `README.md` in each package with: install, basic usage, full API table, gotchas
- [ ] `CONTRIBUTING.md` at root
- [ ] Changeset workflow: `pnpm changeset add` before each PR that changes a package
- [ ] GitHub release automation: `.github/workflows/release.yml` using `changesets/action`
- [ ] Publish to npm under `@bridge` scope (or `@acme/bridge-*` for internal scoping)

---

## Consolidated Gotchas (spec + additions)

| Gotcha | Mitigation |
|--------|-----------|
| `turbopackIgnore` required for runtime imports | Add ESLint rule to enforce magic comment in `@bridge/share` |
| `next/dynamic` with `ssr: false` must be in a `'use client'` file | Lint rule: no `next/dynamic` in Server Components |
| Turbopack root — packages outside project root | Document `turbopack.root` config; add check in `next-config-helper.ts` |
| CORS on manifest + chunk URLs | README snippet for `next.config.ts` `headers()` config |
| Two React instances from remote chunks | `TODO` stub in v0.1; fix in v0.2 with singleton registry |
| Handler modules must have `default` exports | ESLint rule or tsup transform that errors on named-only exports in handler files |
| `requestIdleCallback` not available in all browsers | Already handled via `setTimeout` fallback — add test for the fallback path |
| `IntersectionObserver` not available in jsdom | Mock in vitest setup; test real behaviour in Playwright |
| Event re-dispatch loses original event after async gap | Use snapshot pattern (Fix 2 in Phase 1) |

---

## Implementation Order Summary

```
Phase 0 (1–2 days)   Monorepo, toolchain, CI, shared tsconfig
Phase 1 (3–4 days)   @bridge/lazy-handler — hook, Interactive, HOC, tests
Phase 2 (3–4 days)   @bridge/hydration — all strategies, tests
Phase 3 (4–5 days)   @bridge/share — manifest, hook, RemoteComponent, two-app test
Phase 4 (2–3 days)   Demo app, Lighthouse CI
Phase 5 (2 days)     Docs, changesets, release
```

**Total estimate: ~3 weeks for a single developer at full focus.**

---

## Files to Create (complete list)

```
monorepo-root/
  .github/
    workflows/
      ci.yml
      release.yml
  apps/
    web/
      app/
        demo/
          lazy-handler/page.tsx
          hydration/page.tsx
          share/page.tsx
      next.config.ts
      package.json
      tsconfig.json
    host/
      app/page.tsx
      next.config.ts      ← shareConfig({ exposes: {...} })
      package.json
      tsconfig.json
  packages/
    tsconfig/
      base.json
      package.json
    lazy-handler/
      src/
        index.ts
        use-lazy-handler.ts
        interactive.tsx
        hoc.tsx
        types.ts
      test/
        use-lazy-handler.test.ts
        interactive.test.tsx
      package.json
      tsconfig.json
      tsup.config.ts
    hydration/
      src/
        index.ts
        hydration-boundary.tsx
        use-hydration-state.ts
        strategies/
          visible.ts
          idle.ts
          interaction.ts
        hoc.tsx
        types.ts
      test/
        hydration-boundary.test.tsx
      package.json
      tsconfig.json
      tsup.config.ts
    share/
      src/
        index.ts
        use-remote-component.tsx
        remote-component.tsx
        remote-error-boundary.tsx    ← IMPROVEMENT
        manifest-loader.ts
        version-check.ts
        next-config-helper.ts
        types.ts
      test/
        manifest-loader.test.ts
        use-remote-component.test.tsx
      package.json
      tsconfig.json
      tsup.config.ts
  .changeset/
    config.json
  pnpm-workspace.yaml
  turbo.json
  package.json
  .eslintrc.js
  prettier.config.js
  vitest.config.ts       ← root shared vitest config
  playwright.config.ts   ← root shared Playwright config
```
