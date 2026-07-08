# Apps

Three deployable apps live here. `web` is the **shell**; `host` and
`storefront` are independently-built-and-deployed **remotes** whose UI is
stitched into the shell at runtime via `@nextjs-bridges/share` — a small,
manifest-based alternative to webpack Module Federation.

| App | Port | Role |
|---|---|---|
| `web` | 3000 | Shell — owns the route, page layout, and site chrome (`<Header>`, `<Footer>`, the Categories nav). Consumes remotes, exposes nothing itself. |
| `host` | 3001 | Remote — Checkout team. Reused from the older `/demo/share` example; still exposes its original `./Button` alongside the new `./CartWidget`. |
| `storefront` | 3002 | Remote — Home team + Recommendations team. |

The concrete example is `web`'s `/demo/ecommerce` route
(`apps/web/app/demo/ecommerce/`). Design notes:
`docs/superpowers/specs/2026-07-02-ecommerce-example-design.md`.

## Who exposes what

| Team | App | Exposes | Chunk (built by `tsup`) | Rendered into |
|---|---|---|---|---|
| Checkout | `host` | `./CartWidget` | `public/cartwidget.chunk.js` | Shell's `<Header>` (`apps/web/.../components/header.tsx`) |
| Checkout | `host` | `./Button` | `public/button.chunk.js` | (unused by the ecommerce demo — kept for `/demo/share`) |
| Home | `storefront` | `./HomeWidget` | `public/homewidget.chunk.js` | Shell's `/demo/ecommerce` page, main column |
| Recommendations | `storefront` | `./PopularProductsPanel` | `public/popularproductspanel.chunk.js` | Shell's `/demo/ecommerce` page, sidebar |

Each remote's `next.config.ts` calls `shareConfig({ name, baseUrl, exposes, shared })`
(`@nextjs-bridges/share/next-config-helper`), which writes `public/share-manifest.json` —
a map of expose name → chunk URL + version, plus the app's shared-dep
versions. The shell never imports remote source; it only knows a manifest
URL and an expose name:

```tsx
// apps/web/app/demo/ecommerce/page.tsx
<RemoteComponent manifestUrl="http://localhost:3002/share-manifest.json" expose="./HomeWidget" />
```

`<RemoteComponent>` (`packages/share/src/remote-component.tsx`) does, at
runtime: fetch the manifest → look up the expose → check its version →
confirm required shared deps are present on `window.__bridgeShared` → dynamic
`import()` the chunk URL → call the chunk's default-exported
`mount(container, props) → unmount` function into a `<div>` it owns. The
remote mounts its **own** React root inside that div, so the shell's React
tree never contains elements created by the remote's React instance.

## What's shared, what's duplicated

**React / React-DOM — shared as a runtime singleton, when compatible.**

- `web`'s `next.config.ts` calls `sharedDepsConfig({ provides: ['react', 'react-dom'], ... })`,
  which writes `packages/share/shared-contract.json` with the shell's declared
  versions (currently `^18.3.0` for both) and mounts
  `<BridgeSharedDepsProvider>` in `apps/web/app/layout.tsx`, which publishes
  the shell's live `React`/`ReactDOM`/`ReactDOM.client` instances onto
  `window.__bridgeShared` before any `<RemoteComponent>` can mount.
- Each remote's `tsup.config.ts` reads that same contract at **build time**
  (`loadSharedDepDecisions`) and compares it to its own `package.json`
  version. If compatible (same major, remote's minor ≤ shell's minor), esbuild
  aliases `react`/`react-dom` to thin shims (`packages/share/src/shims/*`)
  that read off `window.__bridgeShared` instead of bundling the real
  package — so the chunk ships **no React of its own** and reuses the
  shell's copy. If incompatible, the remote bundles its own React instead
  (`noExternal: [/react/]` is the fallback).
- Today `host` and `storefront` both declare `react`/`react-dom` `^18.3.0`,
  matching the shell exactly, so both manifests report `"external": true` —
  neither chunk bundles React; both run on the shell's single instance.
  `assertSharedDepsAvailable` (`packages/share/src/shared-dep-guard.ts`)
  throws at mount time if a remote claims `external: true` but the global
  singleton isn't actually there.

**`@nextjs-bridges/lazy-handler` — bundled into every consumer, not shared.**
Both `host` and `storefront` list it as a real `dependency`, and both
`tsup.config.ts`s put it in `noExternal`, so a copy is compiled straight into
`cartwidget.chunk.js`, `homewidget.chunk.js` (via `ProductCard`), etc. There's
no cross-app singleton for it — each remote is free to be on a different
version.

**`@nextjs-bridges/hydration` — shell-only, never shipped to a remote.**
Only `apps/web` depends on it. `<HydrationBoundary>` wraps `<RemoteComponent>`
calls from the *shell* side (deferring when a remote mounts at all); no
remote package.json lists it, so it never ends up in a chunk.

**The `bridge:cart:add` event contract — duplicated on purpose.**
`storefront`'s `add-to-cart.ts`/`quick-view.ts` handlers and `host`'s
`cart-widget.tsx` agree on a `CustomEvent('bridge:cart:add', { id, name, price })`
shape by convention, not by importing a shared type — two independently
deployed teams shouldn't need to ship in lockstep for a 3-field event. Each
side keeps its own copy of the interface.

## Where things live

```
apps/web/app/demo/ecommerce/
  page.tsx                        shell layout — decides where each remote widget goes
  components/header.tsx           shell chrome — hosts host's ./CartWidget
  components/footer.tsx           shell chrome — no remotes
  components/panel-skeleton.tsx   shell-owned fallback UI (shown while a remote loads)
  components/static-cart-icon.tsx shell-owned fallback UI for the cart slot
  handlers/open-categories-menu.ts shell-owned, lazily-loaded nav handler (not a remote)

apps/host/src/components/checkout-team/
  cart-widget.tsx                 exposed as ./CartWidget
  handlers/start-checkout.ts      lazily-loaded on hover of "Proceed to Checkout"

apps/storefront/src/components/
  home-team/home-widget.tsx              exposed as ./HomeWidget
  recommendations-team/popular-products-panel.tsx  exposed as ./PopularProductsPanel
  shared/product-card.tsx                shared within storefront only (not a remote itself)
  shared/handlers/add-to-cart.ts         lazily-loaded per-card, dispatches bridge:cart:add
  shared/handlers/quick-view.ts          lazily-loaded per-card, renders an imperative modal
```

`/demo/ecommerce` also labels every piece in the UI with a small `[shell]` or
`[remote · host]` / `[remote · storefront]` tag so it's visible at a glance
which app rendered what.

## Running the demo

```bash
pnpm --filter web dev       # :3000 — open /demo/ecommerce
pnpm --filter host dev      # :3001
pnpm --filter storefront dev # :3002
```

`web`'s dev server compiles normally (Next/Turbopack), but `host` and
`storefront` serve their exposed components as **pre-built static chunks**
from `public/*.chunk.js` — `next dev` does not recompile these on save. After
editing anything under `src/components/**` in `host` or `storefront`, rebuild
the chunks before reloading the shell:

```bash
pnpm --filter host build:chunks
pnpm --filter storefront build:chunks
```

(`pnpm build` runs `build:chunks` automatically before `next build`; only the
`dev` loop requires the manual step.)
