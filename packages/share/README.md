# @bridge/share

> Runtime cross-app component sharing for Next.js 15 + Turbopack — a manifest-based alternative to Webpack Module Federation.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)

Part of the [`bridges`](https://github.com/chetan25/nextjs-bridges) monorepo — see the [root README](https://github.com/chetan25/nextjs-bridges#readme) for how this fits alongside `@bridge/lazy-handler` and `@bridge/hydration`, and [`apps/Readme.md`](https://github.com/chetan25/nextjs-bridges/blob/main/apps/Readme.md) for a full walkthrough against the `/demo/ecommerce` example (three apps, two teams' widgets, a shared React singleton).

```bash
pnpm add @bridge/share
```

## The problem

Module Federation let one Next.js app serve components to another at runtime. Turbopack has no equivalent plugin API, and Next.js's own App-Router-native answer to this is still unshipped. Sharing UI across independently-deployed apps otherwise means publishing packages and rebuilding both apps on every change.

## How it works

`@bridge/share` implements a lightweight alternative to Webpack Module Federation that works with Turbopack.

**Host app (exposes components):**

1. Runs `generateShareManifest()` at build time (or via `shareConfig()` in `next.config.ts`) to emit a `public/share-manifest.json` describing what it exposes and at which URLs.
2. Builds each exposed component as a self-contained chunk that exports a `mount(container, props) => cleanup` function. Each chunk manages its own React root.

**Consumer app (loads components):**

1. Calls `useRemoteComponent(manifestUrl, exposeName, props)` or renders `<RemoteComponent>`.
2. The hook fetches the manifest (cached for 5 minutes, with retry), resolves the chunk URL, dynamically loads the script, and calls `mount()`.
3. React renders the remote component inside the local tree with no shared runtime conflicts.

**React/React-DOM are shared as a runtime singleton when versions are compatible — not bundled per chunk.** The consumer app mounts `<BridgeSharedDepsProvider>` above any `<RemoteComponent>` usage, which publishes its own `React`/`ReactDOM` instances onto `window.__bridgeShared`. Separately, the consumer's `next.config.ts` calls `sharedDepsConfig({ provides: ['react', 'react-dom'], outputPath })`, writing a small contract file with its declared versions. Each exposing app's build (`tsup.config.ts` + `shared-dep-resolver`) reads that contract and compares it against its own React version: if compatible (same major, its minor ≤ the consumer's), esbuild aliases `react`/`react-dom` to thin shims that read off `window.__bridgeShared` instead of bundling the real package, so the chunk ships no React of its own. If incompatible, the chunk falls back to bundling its own React. `assertSharedDepsAvailable` throws at mount time if a chunk claims `external: true` but the singleton isn't actually present.

## Setup — Host App

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
  // Path to the contract the consumer app wrote via sharedDepsConfig() (below).
  sharedContractPath: '../../packages/share/shared-contract.json',
})({
  // ...your existing Next config
});
```

This writes `public/share-manifest.json` at config-evaluation time (before Turbopack starts) and re-writes it on every Webpack compile.

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

## Setup — Consumer App

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

### `useRemoteComponent(manifestUrl, exposeName, props)`

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

### `<RemoteComponent>`

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

### `loadManifest(url, signal?, retries?)`

Fetch a manifest directly. Returns a cached promise (5-minute TTL). Re-fetches on failure without caching the error.

```ts
import { loadManifest, bustManifestCache } from '@bridge/share';

const manifest = await loadManifest('http://localhost:3001/share-manifest.json');

// Force a fresh fetch (e.g. after a host deploy)
bustManifestCache('http://localhost:3001/share-manifest.json');
```

### `checkVersion(manifest, requiredVersion)`

Optional version compatibility check before mounting.

```ts
import { checkVersion } from '@bridge/share';

const compatible = checkVersion(manifest, '^1.0.0');
if (!compatible) throw new Error('Host app version incompatible');
```

### `generateShareManifest(config)` — standalone

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

## Gotchas

- **Chunks are not automatically built by** `@bridge/share`**.** The library provides the manifest format and runtime loader; you are responsible for building each exposed chunk as a standalone JS file (e.g. via tsup or a custom Turbopack entry). See `apps/host/tsup.config.ts` for a reference.
- **Each chunk manages its own React root** unless externalized via the shared-dep mechanism above. Props are passed as plain `Record<string, unknown>` — no React context, no shared state, no event bubbling across the root boundary. If you need context (theme, auth), pass it as serialisable props or re-create the provider inside the chunk.
- `baseUrl` **must be absolute in production.** The manifest resolver prepends `baseUrl` to chunk paths. In development you can use `http://localhost:3001`; in production set it to the host app's public origin.
- **CORS.** The consumer fetches the manifest and chunks from the host's origin. Configure the host's Next.js response headers to allow the consumer's origin.
- **Manifest TTL.** The in-memory cache expires after 5 minutes. Call `bustManifestCache(url)` after a host deploy if you need immediate propagation, or implement a deploy webhook that calls it.
- **No SSR for remote components.** `useRemoteComponent` is `'use client'` only. Remote components render client-side. Use `loadingFallback` to avoid visible flash.
- **Version pinning is advisory.** `checkVersion` performs a semver range check and returns a boolean — it does not enforce compatibility at the chunk level. If the host and consumer have incompatible prop interfaces, you will get a runtime error, not a build error.

## Known limitations

- **No hot-reload for remote chunks.** After the host rebuilds a chunk, the consumer must reload the page or call `bustManifestCache()` to pick up changes.
- **Shared-dep compatibility check is major/minor only.** `resolveSharedDeps` treats "same major, own minor ≤ consumer's minor" as compatible and externalizes React on that basis — it doesn't account for patch-level breaking changes (rare, but not impossible) or peer libraries beyond React/React-DOM.

## License

[MIT](../../LICENSE)
