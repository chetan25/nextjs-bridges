# bridges

> Composable Next.js primitives for lazy event handlers, declarative hydration boundaries, and runtime cross-app component sharing.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

## The Problem

Next.js 15+ Turbopack removed Webpack Module Federation and introduced a stricter boundary between Server and Client Components. This left three recurring gaps with no first-party solution:

| Gap                                     | Consequence                                                                                                                                                                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Event handler JS ships on page load** | Every `onClick` handler — no matter how rarely used — is bundled into the initial payload. A "Notify me" button's entire handler tree loads even if 95% of users never click it.                                             |
| **Client Components hydrate eagerly**   | Once a subtree is marked `'use client'`, React hydrates the whole thing immediately, including heavy widgets far below the fold. There is no declarative way to say "hydrate this when visible" or "hydrate on first hover." |
| **No runtime cross-app sharing**        | Module Federation let one Next.js app serve components to another at runtime. Turbopack has no equivalent plugin API. Sharing now requires publishing packages and rebuilding both apps on every change.                     |

`bridges` fixes all three with three small, composable libraries that work with the Turbopack bundler and require no Webpack plugins or custom server infrastructure.

---

## Packages

| Package                                       | Purpose                                        | Install                         |
| --------------------------------------------- | ---------------------------------------------- | ------------------------------- |
| `[@bridge/lazy-handler](#bridgelazy-handler)` | Defer event handler JS until first interaction | `pnpm add @bridge/lazy-handler` |
| `[@bridge/hydration](#bridgehydration)`       | Control when a Client Component hydrates       | `pnpm add @bridge/hydration`    |
| `[@bridge/share](#bridgeshare)`               | Runtime cross-app component sharing            | `pnpm add @bridge/share`        |

All three are `'use client'` libraries. They are side-effect-free on the server and tree-shakeable.

> **Status:** these packages are not yet published to npm — the release pipeline (see [Commit Convention & Releases](#commit-convention--releases)) is wired up but hasn't cut a first version yet. Until then, `pnpm add @bridge/...` won't resolve; install from this repo via `pnpm add @bridge/lazy-handler@workspace:*` if you're working inside the monorepo, or watch the repo for the first tagged release.

> **See all three working together:** `apps/web`'s `/demo/ecommerce` page composes a small multi-team storefront — a Shell-owned header/footer, a Checkout team's cart widget, and a Home/Recommendations team's product widgets — using `@bridge/share` to load them, `@bridge/hydration` to defer their mount, and `@bridge/lazy-handler` to defer their interaction JS. Run `pnpm dev` from the repo root and open `http://localhost:3000/demo/ecommerce`.

---

## `@bridge/lazy-handler`

### How it works

Instead of attaching an event listener at mount time, the library attaches a tiny **stub** listener that:

1. Intercepts the first event
2. Dynamically imports the real handler via `import()`
3. Re-dispatches the original event once the handler resolves
4. Caches the module — all subsequent events call the real handler directly with zero overhead

The result: your handler JS is not downloaded until a user actually triggers the event.

### API

#### `useLazyHandler(loader, options?)`

The core hook. Returns a `[ref, stub]` tuple.

```tsx
'use client';
import { useLazyHandler } from '@bridge/lazy-handler';

export function NotifyButton() {
  const [ref] = useLazyHandler<HTMLButtonElement>(
    () => import('./handlers/notify'), // loaded only on first click
    { preloadOn: 'hover' }, // optional: preload on hover
  );

  return <button ref={ref}>Notify me</button>;
}
```

**Options**

| Option      | Type                                                             | Default   | Description                                                     |
| ----------- | ----------------------------------------------------------------- | --------- | ----------------------------------------------------------------- |
| `event`     | `keyof HTMLElementEventMap`                                      | `'click'` | DOM event to intercept                                           |
| `capture`   | `boolean`                                                        | `false`   | Use capture phase                                                 |
| `preloadOn` | `'hover' \| 'focus' \| 'visible' \| 'idle' \| 'none'`, or an array of these | `'none'`  | Trigger an early prefetch before the user fires the real event. An array arms multiple strategies at once — whichever fires first wins. |

Your handler module must export a default function:

```ts
// handlers/notify.ts
export default function notify(event: Event) {
  // runs only when the user clicks
}
```

#### `<Interactive>`

A declarative wrapper that removes the need to manage refs manually. Renders as a `<span>` by default; use the `as` prop to change the element type.

```tsx
import { Interactive } from '@bridge/lazy-handler';

<Interactive on={{ click: () => import('./handlers/notify') }}>
  <button>Notify me</button>
</Interactive>;

{
  /* No layout-breaking div in prose */
}
<Interactive as="span" on={{ click: () => import('./handlers/track') }}>
  <strong>track this link</strong>
</Interactive>;

{
  /* Any event */
}
<Interactive on={{ mouseenter: () => import('./handlers/prefetch-hover') }}>
  <div>Hover to prefetch</div>
</Interactive>;
```

#### `withLazyHandlers(Component, handlers)`

Higher-order component. Wraps an existing component without changing its JSX at the call site.

```tsx
import { withLazyHandlers } from '@bridge/lazy-handler';
import { Button } from './Button';

const LazyButton = withLazyHandlers(Button, {
  click: () => import('./handlers/submit'),
});

// Use exactly like <Button>
<LazyButton>Submit</LazyButton>;
```

### Gotchas

- `currentTarget` **is captured synchronously.** The browser nulls out `event.currentTarget` after the dispatch cycle. The stub captures it before the `import()` call and replays it on the async event via a `Proxy`, so your handler receives a correct `currentTarget` even though it runs after `await`.
- **Double-load guard is built in.** Rapid clicks while the module is in flight are deduplicated — the loader is called exactly once.
- **Each loader ref is stable.** You can pass an inline arrow function as `loader`; the hook holds a ref to the latest version without causing effect re-runs.
- **No SSR output.** The stub is never attached on the server. The element renders as static HTML until the client hydrates — which is the point.
- `preloadOn: 'visible'` **requires** `IntersectionObserver`**.** Falls back to no preload in environments that lack it (e.g. Node/jsdom test environments).
- `preloadOn: 'idle'` **needs no DOM event.** It schedules via `requestIdleCallback` (falling back to `setTimeout(fn, 0)` where unavailable) as soon as the element mounts. Pass an array (e.g. `preloadOn: ['hover', 'idle']`) to arm multiple strategies at once — the first one to fire loads the module; the rest become no-ops.

---

## `@bridge/hydration`

### How it works

`<HydrationBoundary>` wraps any subtree and gates rendering behind a boolean `hydrated` state. Until that state flips, the boundary renders the `fallback` prop (skeleton, spinner, or nothing). Hydration is triggered by a chosen **strategy** — viewport visibility, browser idle time, first pointer contact, or a manual imperative call.

This is purely a React-level deferral. The component JS is still bundled; hydration just determines when React mounts and makes the subtree interactive.

### API

#### `<HydrationBoundary>`

```tsx
import { HydrationBoundary } from '@bridge/hydration';

<HydrationBoundary
  strategy="visible"
  fallback={<Skeleton />}
  rootMargin="200px"
  onHydrate={() => analytics.track('widget-hydrated')}
>
  <HeavyWidget />
</HydrationBoundary>;
```

**Props**

| Prop         | Type                | Default     | Description                                               |
| ------------ | ------------------- | ----------- | --------------------------------------------------------- |
| `strategy`   | `HydrationStrategy` | `'visible'` | When to hydrate (see table below)                         |
| `fallback`   | `ReactNode`         | `null`      | Rendered while dehydrated                                 |
| `threshold`  | `number             | number[]`   | `0.1`                                                     | IntersectionObserver threshold — `visible` strategy only |
| `rootMargin` | `string`            | `'200px'`   | IntersectionObserver rootMargin — `visible` strategy only |
| `onHydrate`  | `() => void`        | —           | Fired once when hydration occurs                          |

**Strategies**

| Strategy      | Triggers hydration when…                                               |
| ------------- | ---------------------------------------------------------------------- |
| `eager`       | Immediately (same as no boundary)                                      |
| `visible`     | The boundary enters the viewport (IntersectionObserver)                |
| `idle`        | The browser is idle (`requestIdleCallback` / `setTimeout(0)` fallback) |
| `interaction` | The user moves a pointer over, tabs into, or touches the boundary      |
| `manual`      | `hydrateNow()` is called imperatively                                  |

#### `useHydrationState()`

Reads the nearest boundary's hydration state and imperative trigger. Must be called inside a `<HydrationBoundary>` — most useful inside a `fallback` slot to place a "Load now" button.

```tsx
import { useHydrationState } from '@bridge/hydration';

function ManualFallback() {
  const { hydrated, hydrateNow } = useHydrationState();
  return <div>{hydrated ? null : <button onClick={hydrateNow}>Load widget</button>}</div>;
}

<HydrationBoundary strategy="manual" fallback={<ManualFallback />}>
  <HeavyWidget />
</HydrationBoundary>;
```

#### `withHydrationBoundary(Component, options?)`

HOC version. Wraps a component in a boundary without changing its usage.

```tsx
import { withHydrationBoundary } from '@bridge/hydration';

const LazyChart = withHydrationBoundary(Chart, {
  strategy: 'visible',
  fallback: <ChartSkeleton />,
});
```

### Nesting

Boundaries nest independently. Each has its own trigger and state.

```tsx
<HydrationBoundary strategy="idle">
  {/* hydrates after page load when browser is idle */}
  <HydrationBoundary strategy="interaction" fallback={<Skeleton />}>
    {/* additionally requires hover/focus before mounting */}
    <VeryHeavyWidget />
  </HydrationBoundary>
</HydrationBoundary>
```

### Gotchas

- **This is render-time deferral, not code-splitting.** The JS bundle for `<HeavyWidget>` is still sent to the browser — it just isn't executed until the strategy triggers. Combine with `React.lazy` + `next/dynamic` for actual code splitting.
- `strategy="eager"` **is a no-op.** The boundary renders children immediately, same as removing it. Useful for toggling deferral in development without changing JSX.
- **No SSR hydration mismatch.** The boundary renders `fallback` on the server as well, so the initial HTML always matches the dehydrated state.
- `IntersectionObserver` **fallback.** When unavailable (Node, jsdom), `strategy="visible"` falls back to hydrating immediately.
- `onHydrate` **stability.** The callback ref is always kept current without causing effects to re-run; you can pass an inline function safely.

---

## `@bridge/share`

### How it works

`@bridge/share` implements a lightweight alternative to Webpack Module Federation that works with Turbopack.

**Host app (exposes components):**

1. Runs `generateShareManifest()` at build time (or via `shareConfig()` in `next.config.ts`) to emit a `public/share-manifest.json` describing what it exposes and at which URLs.
2. Builds each exposed component as a self-contained chunk that exports a `mount(container, props) => cleanup` function. Each chunk manages its own React root.

**Consumer app (loads components):**

1. Calls `useRemoteComponent(manifestUrl, exposeName, props)` or renders `<RemoteComponent>`.
2. The hook fetches the manifest (cached for 5 minutes, with retry), resolves the chunk URL, dynamically loads the script, and calls `mount()`.
3. React renders the remote component inside the local tree with no shared runtime conflicts.

**React/React-DOM are shared as a runtime singleton when versions are compatible — not bundled per chunk.** The consumer app mounts `<BridgeSharedDepsProvider>` above any `<RemoteComponent>` usage, which publishes its own `React`/`ReactDOM` instances onto `window.__bridgeShared`. Separately, the consumer's `next.config.ts` calls `sharedDepsConfig({ provides: ['react', 'react-dom'], outputPath })`, writing a small contract file with its declared versions. Each exposing app's build (`tsup.config.ts` + `shared-dep-resolver`) reads that contract and compares it against its own React version: if compatible (same major, its minor ≤ the consumer's), esbuild aliases `react`/`react-dom` to thin shims that read off `window.__bridgeShared` instead of bundling the real package, so the chunk ships no React of its own. If incompatible, the chunk falls back to bundling its own React — so the host and consumer *can* still run different minor versions, they just don't share a runtime unless they're close enough for it to be safe. `assertSharedDepsAvailable` throws at mount time if a chunk claims `external: true` but the singleton isn't actually present. See `apps/Readme.md` for a concrete walkthrough against the `/demo/ecommerce` example.

### Setup — Host App

```ts
// apps/host/next.config.ts
import { shareConfig } from '@bridge/share/next-config-helper';

export default shareConfig({
  name: 'host-app',
  version: '1.0.0',
  baseUrl: 'http://localhost:3001',
  exposes: {
    './Button': './src/components/Button.tsx',
    './Header': './src/components/Header.tsx',
  },
  shared: { react: {}, 'react-dom': {} },
  // Path to the contract the consumer app wrote via sharedDepsConfig() (below) —
  // read at build time to decide whether this app's React can be externalized.
  sharedContractPath: '../../packages/share/shared-contract.json',
})({
  // ...your existing Next config
});
```

This writes `public/share-manifest.json` at config-evaluation time (before Turbopack starts) and re-writes it on every Webpack compile.

The consumer/shell app declares the versions it's willing to share, and mounts the provider that publishes them at runtime:

```ts
// apps/web/next.config.ts (the consumer/shell app)
import { sharedDepsConfig } from '@bridge/share/next-config-helper';

export default sharedDepsConfig({
  provides: ['react', 'react-dom'],
  outputPath: '../../packages/share/shared-contract.json',
})({
  // ...your existing Next config
});
```

```tsx
// apps/web/app/layout.tsx
import { BridgeSharedDepsProvider } from '@bridge/share';

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

The chunk itself must export a default `MountFunction`:

```tsx
// src/components/Button.tsx  (the exposed entry)
import { createRoot } from 'react-dom/client';
import { Button } from './Button.impl';

export default function mount(container: HTMLElement, props: Record<string, unknown>) {
  const root = createRoot(container);
  root.render(<Button {...(props as ButtonProps)} />);
  return () => root.unmount();
}
```

### Setup — Consumer App

#### `useRemoteComponent(manifestUrl, exposeName, props)`

```tsx
'use client';
import { useRemoteComponent } from '@bridge/share';

export function RemoteButtonSlot() {
  const { mount, loading, error } = useRemoteComponent(
    'http://localhost:3001/share-manifest.json',
    './Button',
    { label: 'Click me' },
  );

  if (loading) return <Spinner />;
  if (error) return <p>Failed to load remote component.</p>;
  if (!mount) return null;

  // mount is a stable MountFunction — attach it to a container element
  return <RemoteMountPoint mount={mount} />;
}
```

#### `<RemoteComponent>`

The declarative wrapper. Handles the container div and cleanup automatically.

```tsx
import { RemoteComponent, RemoteErrorBoundary } from '@bridge/share';

<RemoteErrorBoundary fallback={<p>Remote unavailable</p>}>
  <RemoteComponent
    manifestUrl="http://localhost:3001/share-manifest.json"
    expose="./Button"
    props={{ label: 'Click me', variant: 'primary' }}
    loadingFallback={<Spinner />}
  />
</RemoteErrorBoundary>;
```

#### `loadManifest(url, signal?, retries?)`

Fetch a manifest directly. Returns a cached promise (5-minute TTL). Re-fetches on failure without caching the error.

```ts
import { loadManifest, bustManifestCache } from '@bridge/share';

const manifest = await loadManifest('http://localhost:3001/share-manifest.json');

// Force a fresh fetch (e.g. after a host deploy)
bustManifestCache('http://localhost:3001/share-manifest.json');
```

#### `checkVersion(manifest, requiredVersion)`

Optional version compatibility check before mounting.

```ts
import { checkVersion } from '@bridge/share';

const compatible = checkVersion(manifest, '^1.0.0');
if (!compatible) throw new Error('Host app version incompatible');
```

#### `generateShareManifest(config)` — standalone

If you don't want the `next.config.ts` wrapper, call this directly from a `prebuild` script:

```js
// scripts/generate-manifest.js
const { generateShareManifest } = require('@bridge/share/next-config-helper');

generateShareManifest({
  name: 'host-app',
  version: '1.0.0',
  baseUrl: process.env.BASE_URL,
  exposes: { './Button': './src/components/Button.tsx' },
  outputDir: 'public',
});
```

### Gotchas

- **Chunks are not automatically built by** `@bridge/share`**.** The library provides the manifest format and runtime loader; you are responsible for building each exposed chunk as a standalone JS file (e.g. via tsup or a custom Turbopack entry). See `apps/host/tsup.config.ts` for a reference.
- **Each chunk manages its own React root.** Props are passed as plain `Record<string, unknown>` — no React context, no shared state, no event bubbling across the root boundary. If you need context (theme, auth), pass it as serialisable props or re-create the provider inside the chunk.
- `baseUrl` **must be absolute in production.** The manifest resolver prepends `baseUrl` to chunk paths. In development you can use `http://localhost:3001`; in production set it to the host app's public origin.
- **CORS.** The consumer fetches the manifest and chunks from the host's origin. Configure the host's Next.js response headers to allow the consumer's origin.
- **Manifest TTL.** The in-memory cache expires after 5 minutes. Call `bustManifestCache(url)` after a host deploy if you need immediate propagation, or implement a deploy webhook that calls it.
- **No SSR for remote components.** `useRemoteComponent` is `'use client'` only. Remote components render client-side. Use `loadingFallback` to avoid visible flash.
- **Version pinning is advisory.** `checkVersion` performs a semver range check and returns a boolean — it does not enforce compatibility at the chunk level. If the host and consumer have incompatible prop interfaces, you will get a runtime error, not a build error.

---

## Monorepo Structure

```
apps/
  web/          Next.js 15 demo app (all three packages exercised)
  host/         Second Next.js app — Checkout team (serves ./Button and ./CartWidget)
  storefront/   Third Next.js app — Home + Recommendations teams (serves ./HomeWidget, ./PopularProductsPanel)
packages/
  lazy-handler/ @bridge/lazy-handler source
  hydration/    @bridge/hydration source
  share/        @bridge/share source
docs/           Spec and implementation plan
```

**Toolchain:** pnpm workspaces · Turbo · tsup · Vitest · Playwright · semantic-release

```bash
pnpm install          # install all deps
pnpm dev              # start all apps in watch mode
pnpm build            # build all packages and apps
pnpm test             # unit tests (Vitest)
pnpm test:e2e         # end-to-end tests (Playwright)
pnpm type-check       # TypeScript across the monorepo
```

---

## Commit Convention & Releases

Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat: ...`, `fix: ...`, `feat(share)!: ...` for a breaking change, etc.) — this is what drives versioning, so it's enforced two ways:

- **Locally:** a Husky `commit-msg` hook runs `commitlint` against every commit.
- **In CI:** the `commitlint` job in `.github/workflows/ci.yml` lints every commit on a pull request.

Each of the three packages (`packages/lazy-handler`, `packages/hydration`, `packages/share`) releases **independently** via [semantic-release](https://semantic-release.gitbook.io/), using [`semantic-release-monorepo`](https://github.com/pmowrer/semantic-release-monorepo) to scope commit analysis to only the commits that touched that package's own directory. On every push to `main`, `.github/workflows/release.yml`:

1. Runs `semantic-release` for each package in turn.
2. Determines the next version from the commit types since that package's last release tag (`fix:` → patch, `feat:` → minor, `!`/`BREAKING CHANGE:` → major).
3. Publishes to npm, generates/updates that package's `CHANGELOG.md`, tags the release (e.g. `@bridge/share@1.2.0`), and opens a GitHub Release.
4. A change to only one package does not version-bump the others.

This requires an `NPM_TOKEN` repo secret (an npm automation token with publish access to the `@bridge` scope) — `GITHUB_TOKEN` is provided automatically by Actions. Until `NPM_TOKEN` is set and a `feat`/`fix` commit lands on `main`, the release job will run and fail at the npm-auth step by design; nothing publishes accidentally.

---

## Troubleshooting

### Windows: `pnpm dev` fails with `error while loading shared libraries` / exit code `3221225781`

This is Turborepo's native CLI (`turbo.exe`, from `@turbo/windows-64`) failing to load, not Node.js or Turbopack. It shows up as:

```
ELIFECYCLE  Command failed with exit code 3221225781.
C:/Program Files/nodejs/node.exe: error while loading shared libraries: ?: cannot open shared object file: No such file or directory
```

**Root cause:** third-party antivirus (commonly Kaspersky) blocking or interfering with the freshly-downloaded, unsigned `turbo.exe` binary via its real-time protection / reputation heuristics. A `pnpm install --force` or full `node_modules` reinstall does **not** fix this — the reinstalled binary hits the same block. Turbopack (Next.js's own bundler, used inside each app's `next dev --turbopack`) is a separate binary and is unaffected — you can still run the apps.

**Fix:**

1. Add an exclusion in your antivirus for the repo folder (and/or your global pnpm store) so `turbo.exe` is allowed to run — e.g. in Kaspersky: **Settings → Threats and Exclusions → Manage exclusions**, add this repo's path.
2. Until that's done, bypass `turbo` and start each app directly, in separate terminals, from the repo root:

   ```bash
   pnpm --filter web dev        # http://localhost:3000
   pnpm --filter host dev       # http://localhost:3001
   pnpm --filter storefront dev # http://localhost:3002
   ```

---

## Missing Features / Known Limitations

These are gaps in the current implementation that are on the roadmap but not yet shipped:

- `@bridge/lazy-handler`**: no loading state API.** The stub fires the real handler after the `import()` resolves but there is no built-in way to show a spinner during the load. You can work around this by managing state in the parent component.
- `@bridge/hydration`**: no code-splitting integration.** The boundary defers hydration but the bundle is still sent eagerly. First-class `next/dynamic` + boundary composition is not wired up yet.
- `@bridge/hydration`**:** `strategy="interaction"` **triggers on any pointer contact.** There is no way to narrow the trigger to a specific event type (e.g. `click` only) through the declarative API. Use `withHydrationBoundary` with `useHydrationState` to build a custom trigger.
- `@bridge/share`**: no hot-reload for remote chunks.** After the host rebuilds a chunk, the consumer must reload the page or call `bustManifestCache()` to pick up changes.
- `@bridge/share`**: shared-dep compatibility check is major/minor only.** `resolveSharedDeps` treats "same major, own minor ≤ consumer's minor" as compatible and externalizes React on that basis — it doesn't account for patch-level breaking changes (rare, but not impossible) or peer libraries beyond React/React-DOM.
- **No Edge Runtime support.** All three packages use browser APIs (`IntersectionObserver`, `requestIdleCallback`, `document`, `createRoot`) and are bundled for the browser. They cannot be imported in Next.js middleware or Edge routes.
- **React 18 minimum.** Packages use `createRoot` and `Suspense` APIs introduced in React 18.

---

## License

[MIT](./LICENSE)
