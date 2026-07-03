# Quick View Modal + Idle Preload — Design Spec

**Goal:** Add two more realistic lazy-loading interactions to the `/demo/ecommerce` example so it exercises `@bridge/lazy-handler` in more varied, real-world shapes: (1) a Quick View modal per product, whose code is preloaded on *either* hover of its trigger button *or* browser idle time — whichever comes first, and (2) a hover-preloaded "Categories" mega-menu in the shell header, replacing a currently-dead nav item. Together these round out the demo beyond the single "Add to Cart" / "Proceed to Checkout" hover-preload pattern it has today.

**Non-goal:** No new bridge package. No changes to `@bridge/share` or `@bridge/hydration`. No real product data, routing, or backend — placeholder content only, consistent with the rest of the ecommerce demo.

---

## 1. Core library change: `@bridge/lazy-handler` gains an `'idle'` preload strategy, and `preloadOn` accepts multiple strategies

Today `preloadOn` is a single value (`'hover' | 'focus' | 'visible' | 'none'`), and the effect in `use-lazy-handler.ts` picks one branch (`if (preloadOn === 'visible') {...} else if (preloadOn !== 'none') {...}`). The Quick View button needs *both* "preload on hover" and "preload on idle" active at once — whichever fires first wins, and the existing `handlerRef.current`/`loadingRef.current` guards already make a second trigger a safe no-op. This requires two changes:

- **New `'idle'` strategy**, mirroring `@bridge/hydration`'s existing `strategy="idle"` (`packages/hydration/src/hydration-boundary.tsx`): use `requestIdleCallback` when available, falling back to `setTimeout(fn, 0)`; the pending callback is cancelled (`cancelIdleCallback`/`clearTimeout`) on effect cleanup. Unlike hover/focus, idle preload needs no DOM event listener — it fires automatically once the element mounts.
- **`preloadOn` accepts an array**: `PreloadStrategy | PreloadStrategy[]`, where `PreloadStrategy = 'hover' | 'focus' | 'visible' | 'idle' | 'none'`. When an array is given, every listed strategy is armed simultaneously. `'none'` remains meaningful only as the sole/default value; if present alongside other strategies in an array it's simply ignored (no validation/warning — documented as a no-op, not an error).

### API surface changes

`packages/lazy-handler/src/types.ts`:
```ts
export type PreloadStrategy = 'hover' | 'focus' | 'visible' | 'idle' | 'none';

export interface LazyHandlerOptions {
  event?: keyof HTMLElementEventMap;
  capture?: boolean;
  preloadOn?: PreloadStrategy | PreloadStrategy[];
}
```

`packages/lazy-handler/src/use-lazy-handler.ts`: normalize `preloadOn` to an array up front (`const strategies = Array.isArray(preloadOn) ? preloadOn : [preloadOn]`), then within the mount effect, loop over `strategies` and, for each non-`'none'` entry, arm the corresponding trigger (DOM listener for hover/focus, `IntersectionObserver` for visible, `requestIdleCallback`/`setTimeout` for idle). All armed triggers share the same `doPreload()` guard function already in the hook, so only one actually loads the module regardless of how many strategies are configured. The cleanup function tears down whichever triggers were armed (event listeners removed, observer disconnected, idle callback cancelled).

### Tests (TDD, added to `packages/lazy-handler/test/use-lazy-handler.test.tsx`)

- `preloads on idle when preloadOn='idle'` — mock/stub `requestIdleCallback` (or rely on the `setTimeout` fallback in jsdom, which lacks `requestIdleCallback`), assert loader called, handler not yet invoked.
- `preloads on whichever of hover/idle fires first when preloadOn=['hover','idle']` — fire `mouseenter` only, assert loader called once; separately, let the idle timeout fire without a prior hover, assert loader called once; assert in both cases a subsequent click does not reload (cached handler served).
- `cancels the pending idle callback on unmount` — unmount before the idle timeout fires, advance fake timers, assert loader never called.

### Docs

`README.md`'s `@bridge/lazy-handler` API table (`preloadOn` row) updated to show the new `'idle'` value and array form; a new Gotcha added noting `'idle'` requires no DOM event and that array values are OR'd together (first trigger wins).

---

## 2. Product Quick View modal (`apps/storefront`)

### `ProductCard` changes (`apps/storefront/src/components/shared/product-card.tsx`)

A second button, "Quick View", added next to "Add to Cart", wired via its own `useLazyHandler` call:

```ts
const [quickViewRef] = useLazyHandler<HTMLButtonElement>(
  () => import('./handlers/quick-view'),
  { preloadOn: ['hover', 'idle'] },
);
```

Same `data-id` / `data-name` / `data-price` convention as the existing Add to Cart button, plus `data-color` (so the modal can reuse the card's placeholder color block at a larger size).

### Quick View handler (`apps/storefront/src/components/shared/handlers/quick-view.ts`)

A new lazily-loaded, imperative handler — same style as `start-checkout.ts` and `add-to-cart.ts` (a plain function operating on the DOM, no React state), so loading it lazily means loading a genuinely separate chunk of real UI code, not just a small callback:

- Reads `id`/`name`/`price`/`color` off the trigger button's `data-*` attributes.
- Builds a backdrop `<div>` (fixed, full-viewport, semi-transparent) and a centered panel `<div>` (large color block, product name, price, a short placeholder description, a "×" close button, and an "Add to Cart" button), appended to `document.body`.
- Closes on: clicking the backdrop, clicking "×", or pressing Escape (a `keydown` listener added on open, removed on close) — removes both DOM nodes and the listener, no leaks.
- The modal's own "Add to Cart" button dispatches the same `window.dispatchEvent(new CustomEvent('bridge:cart:add', { detail: { id, name, price } }))` used by `add-to-cart.ts`, duplicated inline (3 lines) rather than imported — consistent with this codebase's existing convention (documented in the prior ecommerce spec's "Cross-widget cart sync" section) of treating the event name/shape as a duplicated contract between independent handler modules, not a shared import.
- Clicking "Add to Cart" inside the modal also closes the modal and briefly relabels its own button "Added ✓" (mirroring the existing add-to-cart button's feedback), then closes after a short delay.

No changes needed to `apps/storefront/tsup.config.ts` — dynamic `import()` calls inside an existing tsup entry are automatically split into their own output chunk (this is exactly how `add-to-cart-VGLPFE4L.chunk.js` already gets produced from `home-widget.tsx`'s entry).

---

## 3. Categories hover mega-menu (`apps/web`, shell-owned)

The header's "Categories" nav item (`apps/web/app/demo/ecommerce/components/header.tsx`) is currently a static, non-interactive `<span>`. This becomes a second, distinct lazy-hover example — deliberately **not** a `@bridge/share` remote widget, since nav chrome is the shell's own concern (same reasoning the existing spec gives for `<Header>`/`<Footer>` being shell-owned, non-remote components):

- `<span>Categories</span>` → `<button ref={categoriesRef}>Categories</button>`, using `useLazyHandler` with `{ preloadOn: 'hover' }` pointed at a new local module.
- New handler: `apps/web/app/demo/ecommerce/handlers/open-categories-menu.ts` — same imperative-DOM style as the storefront/host handlers (this repo's established convention for lazy-handler payloads). Renders a small dropdown panel positioned under the nav item with ~4 static category links ("Footwear", "Bags", "Accessories", "Home Goods" — plain non-navigating `<a href="#">` placeholders, consistent with "Home"/"Deals" being non-functional placeholders today). Closes on outside click or Escape.
- No build config changes needed — `apps/web` is a normal Next.js/Turbopack app; dynamic `import()` in a `'use client'` component code-splits automatically.

---

## Error handling

Both new handlers follow the existing handlers' implicit contract: they assume their trigger element has valid `data-*` attributes (guaranteed by the component that renders the `ref`, same assumption `add-to-cart.ts` already makes) and do nothing defensive beyond that — consistent with the rest of this demo's handlers. The modal and menu are pure client-side DOM insertions with no network calls, so there's no loading-failure state to handle beyond what `useLazyHandler`'s existing `.catch()` (silently resets `loadingRef`) already covers if the dynamic import itself fails.

---

## Testing / verification plan

- **TDD for the core hook change** (Section 1): failing tests written first in `packages/lazy-handler/test/use-lazy-handler.test.tsx`, following the existing file's patterns (fake timers / direct event dispatch, no mocking beyond the loader itself).
- `pnpm --filter @bridge/lazy-handler test` and `tsc --noEmit` stay green; other packages' existing suites are unaffected (no changes to `@bridge/share` or `@bridge/hydration`).
- After implementation: `pnpm --filter @bridge/lazy-handler build`, then `pnpm --filter storefront build:chunks` (host is untouched by this spec, so no host rebuild needed).
- Manual browser verification (Playwright MCP, same approach used to confirm the checkout-button fix earlier this session):
  - Hovering "Quick View" triggers the handler chunk to load before any click (visible in the network log).
  - Waiting without hovering (idle) also triggers the load, on a fresh page with no prior interaction.
  - Clicking "Quick View" opens the modal with the correct product's name/price/color; Escape, backdrop click, and "×" all close it; "Add to Cart" inside the modal increments the header cart badge and closes the modal.
  - Hovering "Categories" loads and opens the mega-menu; clicking outside it closes it.
- No new automated component tests for the demo widgets themselves (modal, mega-menu) — consistent with the existing project convention that demo/example components aren't unit-tested, only the bridge packages are.

---

## Out of scope / follow-ups

- No real product catalog, routing to a product detail page, or persistence — Quick View is a client-side overlay only, same fidelity as the rest of the demo.
- No keyboard focus trapping inside the modal (focus moves to it but doesn't cycle) — a real production modal would add this; left out here to keep the example focused on the lazy-loading pattern, not modal accessibility best practices.
- Categories menu links are non-functional placeholders (`href="#"`), matching "Home" and "Deals" already being non-functional in the existing header.
