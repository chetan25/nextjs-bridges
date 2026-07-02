# E-Commerce Example — Design Spec

**Goal:** Replace the generic, disconnected `@bridge/share` demo (a single "click me" button loaded from `apps/host`) with a realistic multi-team e-commerce scenario that puts all three bridges (`@bridge/share`, `@bridge/hydration`, `@bridge/lazy-handler`) to work together in one page, so a reader can see *why* each primitive exists, not just that it functions in isolation.

**Non-goal:** This does not touch the packages' public APIs. It is purely a new example built on top of the existing `@bridge/share`, `@bridge/hydration`, and `@bridge/lazy-handler` primitives, plus one small demo-local convention (a `window` CustomEvent) for cross-root state sync. The existing isolated `/demo/lazy-handler`, `/demo/hydration`, and `/demo/share` pages, and `apps/host`'s existing `./Button` expose, are left working exactly as they are today.

---

## Scenario

An e-commerce storefront is built by three independent teams, each owning its own deployable Next.js app:

| Team | App | Owns |
|---|---|---|
| **Shell** | `apps/web` | Site chrome: `<Header>` (logo, nav, cart icon) and `<Footer>`. Also owns the `/demo/ecommerce` route's overall layout — it decides *where* each remote team's widget goes, not what's inside it. |
| **Checkout team** | `apps/host` (existing app, reused — keeps its port and its existing `./Button` expose untouched) | The `CartWidget` shown in the Shell's header: icon, running item count, and a small dropdown of added items. |
| **Home team** and **Recommendations team** | `apps/storefront` (new app, port 3002) | Two separate teams sharing one deployment for demo purposes, kept in clearly separate folders: Home team owns `HomeWidget` (hero + main product grid, the primary `/` content); Recommendations team owns `PopularProductsPanel` (a side panel of trending products). |

This mirrors a real storefront: the shell doesn't know or care what's inside the widgets it's arranging — it just knows *where* they go and *when* to let them mount.

---

## Architecture

### App topology

```
apps/
  web/          Shell — unchanged app, new route added
  host/         Checkout team — existing app, new expose added alongside the existing one
  storefront/   NEW — Home team + Recommendations team, two exposes
```

`apps/storefront` is scaffolded identically to `apps/host`'s existing pattern (same `package.json` shape, same `tsup.config.ts` shim-aliasing logic, same `shareConfig()` usage in `next.config.ts`) since it needs the same shared-dep externalization support. Port **3002**.

### Route composition (`apps/web/app/demo/ecommerce/page.tsx`)

```
<Shell>                                                    (apps/web, shell-owned)
  <Header>
     <Logo/>  <Nav/>
     <HydrationBoundary strategy="idle" fallback={<StaticCartIcon/>}>
       <RemoteComponent manifestUrl={HOST_MANIFEST} expose="./CartWidget" .../>
     </HydrationBoundary>
  </Header>

  <main>
    <RemoteComponent manifestUrl={STOREFRONT_MANIFEST} expose="./HomeWidget" .../>

    <aside>
      <HydrationBoundary strategy="visible" fallback={<PanelSkeleton/>}>
        <RemoteComponent manifestUrl={STOREFRONT_MANIFEST} expose="./PopularProductsPanel" .../>
      </HydrationBoundary>
    </aside>
  </main>

  <Footer/>                                                (shell-owned, static, no bridges)
</Shell>
```

`<Header>`, `<Footer>`, and the page shell itself are ordinary shell-owned components — no bridge involved, same as a real app's chrome wouldn't be remote-loaded. `HOST_MANIFEST` is `http://localhost:3001/share-manifest.json` (existing, same constant the current `/demo/share` page uses); `STOREFRONT_MANIFEST` is the new `http://localhost:3002/share-manifest.json`.

### Bridge-to-widget mapping

| Bridge | Applied to | Configuration | Why |
|---|---|---|---|
| `@bridge/share` | `CartWidget`, `HomeWidget`, `PopularProductsPanel` | `<RemoteComponent>` pointed at each app's manifest | The actual cross-team loading mechanism — three components from two independently-built apps, composed into one page |
| `@bridge/hydration` | `CartWidget` → `strategy="idle"`; `PopularProductsPanel` → `strategy="visible"`; `HomeWidget` → left eager (no boundary) | Fallbacks: `<StaticCartIcon/>` (icon with no count), `<PanelSkeleton/>` (gray placeholder blocks) | Shows deferral decisions differ per widget: header chrome shouldn't block on non-critical cart logic, a below-the-fold panel shouldn't cost anything until scrolled to, but the primary hero content should render immediately — `HomeWidget` left un-boundaried is the explicit control/contrast case |
| `@bridge/lazy-handler` | "Add to Cart" button on every `ProductCard` (used inside both `HomeWidget` and `PopularProductsPanel`); `CartIcon`'s dropdown toggle | Add-to-cart: default `preloadOn: 'none'` (defer until first click). Cart dropdown: `preloadOn: 'hover'` | Shows deferred interaction JS living *inside* a remotely-loaded component — the two bridges compose, they aren't mutually exclusive |

---

## Cross-widget cart sync

`CartWidget` (mounted from `apps/host`, its own React root) and the `ProductCard`'s "Add to Cart" button (mounted from `apps/storefront`, a different React root, possibly a different app entirely) cannot share React context or props — `@bridge/share`'s design is explicitly one React root per mounted chunk with no cross-root bridging (see README's `@bridge/share` Gotchas). This is a real constraint every multi-team microfrontend setup hits.

**Solution — plain browser events as the contract**, no new package or shared API:

1. The lazy-loaded add-to-cart handler module (`apps/storefront/src/components/shared/handlers/add-to-cart.ts`) reads the product's `id`/`name`/`price` off the button's `data-*` attributes and calls:
   ```ts
   window.dispatchEvent(
     new CustomEvent('bridge:cart:add', { detail: { id, name, price } }),
   );
   ```
2. `CartWidget`'s mount function (`apps/host/src/components/checkout-team/cart-widget.tsx`) adds a `window.addEventListener('bridge:cart:add', ...)` in a `useEffect`, appending to its own local `useState` list, and removes the listener on unmount (the function returned by `mount()`).
3. The event name (`'bridge:cart:add'`) and payload shape are duplicated as a small local type in both apps rather than imported from a shared package — this is deliberate: two independently-deployed teams in the real world coordinate on a contract (a string + a shape), not a shared TypeScript import, and duplicating the tiny type here keeps the demo honest about that constraint instead of papering over it with a monorepo-only shortcut.

This is called out with an inline comment at both dispatch and listen sites pointing at each other by relative path, since there's no compiler link between them.

---

## Components to build

**`apps/web`** (Shell):
- `app/demo/ecommerce/page.tsx` — composes the layout above (`'use client'`, since `RemoteComponent`/`HydrationBoundary` are client-only)
- `app/demo/ecommerce/components/header.tsx`, `footer.tsx` — static shell chrome
- `app/demo/ecommerce/components/static-cart-icon.tsx` — hydration fallback for `CartWidget`
- `app/demo/ecommerce/components/panel-skeleton.tsx` — hydration fallback for `PopularProductsPanel`
- `app/page.tsx` — add a nav link to `/demo/ecommerce`, alongside the existing three links (not replacing them)

**`apps/host`** (Checkout team) — additive, existing `./Button` expose untouched:
- `src/components/checkout-team/cart-widget.tsx` — mount-function component; icon + badge count + dropdown of added items; listens for `bridge:cart:add`
- `next.config.ts` — add `'./CartWidget': './src/components/checkout-team/cart-widget.tsx'` to `shareConfig()`'s `exposes`
- `tsup.config.ts` — add `'cart-widget': 'src/components/checkout-team/cart-widget.tsx'` to the `entry` map

**`apps/storefront`** (new app — Home team + Recommendations team):
- `package.json`, `next.config.ts`, `tsup.config.ts`, `next-env.d.ts` — scaffolded from `apps/host`'s equivalents, name `storefront`, port 3002, `exposes: { './HomeWidget': ..., './PopularProductsPanel': ... }`
- `src/components/home-team/home-widget.tsx` — hero banner + grid of ~4 `ProductCard`s, mount-function component
- `src/components/recommendations-team/popular-products-panel.tsx` — heading + list of ~3 `ProductCard`s, mount-function component
- `src/components/shared/product-card.tsx` — placeholder box (colored `<div>`, product name, price, Add to Cart button) shared by both widgets *within this app only*
- `src/components/shared/handlers/add-to-cart.ts` — the lazily-loaded handler described above
- `app/page.tsx` — minimal placeholder page (mirrors `apps/host/app/page.tsx`'s "this app exposes..." stub)

**Root-level**:
- `turbo.json` — add `"storefront#build": { "dependsOn": ["^build", "web#build"], "outputs": [...] }`, same reasoning as the existing `host#build` override (both need `packages/share/shared-contract.json` fresh from `apps/web`'s build before their `tsup` build reads it)
- `README.md` — mention the new `/demo/ecommerce` example and `apps/storefront` in the Monorepo Structure section

### Dependency additions

- `apps/host/package.json` — add `"@bridge/lazy-handler": "workspace:*"` (needed by `CartWidget`'s dropdown toggle)
- `apps/storefront/package.json` — add both `"@bridge/share": "workspace:*"` and `"@bridge/lazy-handler": "workspace:*"` (the latter needed by `ProductCard`'s Add to Cart button), plus the same `next`/`react`/`react-dom`/`@bridge/tsconfig` deps as `apps/host`'s `package.json`

### Bundling `@bridge/lazy-handler` into chunks

`apps/host`'s existing `tsup.config.ts` sets `noExternal: [/react/]` — tsup's default is to leave any `package.json` dependency external (an unresolved bare specifier in the output), and only `react`/`react-dom` are force-bundled today because `button.tsx` never imported another workspace package. `CartWidget` and `ProductCard` do (`@bridge/lazy-handler`), so both `apps/host/tsup.config.ts` and `apps/storefront/tsup.config.ts` need `noExternal` extended to also force-bundle it, e.g. `noExternal: [/react/, '@bridge/lazy-handler']` — otherwise the chunk ships a bare `import ... from "@bridge/lazy-handler"` that the browser cannot resolve (there is no import map in this design, unlike react/react-dom's shim-alias mechanism). Unlike react/react-dom, `@bridge/lazy-handler` is never externalized/aliased — it's small, not a singleton concern, and simply gets bundled directly into each chunk that uses it, same as any other regular dependency.

---

## Error handling

Both `<RemoteComponent>` usages in the new page are wrapped in `<RemoteErrorBoundary>` (already part of `@bridge/share`) with a fallback appropriate to the slot — e.g. the cart failing to load falls back to `<StaticCartIcon/>` (same as its hydration fallback), and the panel failing to load shows a small "Recommendations unavailable" message rather than breaking the page. This is the same pattern the existing `/demo/share` page already uses (`errorFallback` prop), applied per-widget instead of generically.

---

## Testing / verification plan

- Existing Vitest suites in `packages/share`, `packages/hydration`, `packages/lazy-handler` are unaffected (no package API changes) — `pnpm test` should stay green throughout.
- Manual smoke test (per `pnpm dev` running all three apps): open `/demo/ecommerce`, confirm:
  - Cart icon appears immediately (static fallback), then becomes interactive after the browser goes idle
  - Home widget's hero + product grid render immediately, no fallback
  - Scrolling to the side panel triggers its remote load (Network tab shows the storefront chunk load on scroll, not on page load)
  - Clicking "Add to Cart" on any product card (in either widget) increments the header cart badge and adds an entry to its dropdown, with a short delay on first click only (handler JS loading) — subsequent clicks are instant
  - No console errors about `window.__bridgeShared` (shared-dep externalization must still resolve correctly for both `apps/host` and `apps/storefront`, per the prior shared-dep-externalization work)
- No new automated component tests are required for the new demo widgets specifically (they are example/demo code, consistent with how `apps/host/src/components/button.tsx` has no dedicated test file today) — the bridges' own packages remain the tested surface.

---

## Out of scope / follow-ups

- No real cart persistence, checkout flow, or backend — this is a front-end composition example only.
- No automated end-to-end (Playwright) coverage of the new page in this pass; could be added later following the existing `test:e2e` setup.
- If a real project wanted a typed contract instead of a duplicated string/shape, that would be a natural follow-up package (e.g. a tiny `@bridge/events` bus) — deliberately not built here, see "Cross-widget cart sync" above for why.
