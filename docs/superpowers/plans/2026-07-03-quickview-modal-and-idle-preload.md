# Quick View Modal + Idle Preload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `'idle'` preload strategy (and multi-strategy `preloadOn` support) to `@bridge/lazy-handler`, then use it to build two new real-world lazy-loading examples in the `/demo/ecommerce` app: a per-product Quick View modal (preloaded on hover-or-idle) and a hover-preloaded Categories mega-menu in the shell header.

**Architecture:** One core library change (`packages/lazy-handler`) followed by two independent demo features built on top of it — a storefront-owned modal (`apps/storefront`) and a shell-owned nav menu (`apps/web`). Both new demo handlers follow the existing codebase convention: plain imperative functions that mutate the DOM directly (no React state), matching `start-checkout.ts` and `add-to-cart.ts`.

**Tech Stack:** React 18, Next.js 15 (Turbopack), TypeScript, tsup (for `apps/host`/`apps/storefront` chunk bundling), Vitest + Testing Library (for `packages/lazy-handler`).

## Global Constraints

- No changes to `@bridge/share` or `@bridge/hydration` — only `@bridge/lazy-handler` gains new capability.
- New handler modules are plain functions receiving a DOM `Event`, doing imperative DOM work — no React state, no JSX, matching every existing handler in `apps/host` and `apps/storefront`.
- Cross-widget communication (Quick View's "Add to Cart") reuses the existing `window.dispatchEvent(new CustomEvent('bridge:cart:add', { detail: { id, name, price } }))` contract, duplicated inline rather than imported (existing project convention — see `docs/superpowers/specs/2026-07-02-ecommerce-example-design.md`, "Cross-widget cart sync").
- No new npm dependencies — `apps/web`, `apps/storefront`, and `apps/host` already depend on `@bridge/lazy-handler` (`workspace:*`).
- Follow TDD for the `packages/lazy-handler` change: write the failing test, watch it fail, then implement.

---

### Task 1: `@bridge/lazy-handler` — add `'idle'` preload strategy and multi-strategy `preloadOn`

**Files:**
- Modify: `packages/lazy-handler/src/types.ts`
- Modify: `packages/lazy-handler/src/use-lazy-handler.ts`
- Modify: `packages/lazy-handler/src/index.ts`
- Modify: `packages/lazy-handler/test/use-lazy-handler.test.tsx`
- Modify: `README.md` (lines 68-74, 127-134 — see below)

**Interfaces:**
- Produces: `PreloadStrategy` type (`'hover' | 'focus' | 'visible' | 'idle' | 'none'`), exported from `@bridge/lazy-handler`. `LazyHandlerOptions.preloadOn` becomes `PreloadStrategy | PreloadStrategy[]`. `useLazyHandler`'s existing return signature (`[(node: T | null) => void, (e: Event) => void]`) is unchanged — Task 2 and Task 3 consume it exactly as `ProductCard`/`CartWidget` already do today.

- [ ] **Step 1: Write the failing tests**

Open `packages/lazy-handler/test/use-lazy-handler.test.tsx`. First, update the top-level `afterEach` so fake timers used by the new tests can't leak into later tests:

```ts
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
```

Then add these three tests at the end of the `describe('useLazyHandler', ...)` block, after the existing `'attaches the listener when the ref target mounts after initial render'` test (keep that test as-is):

```ts
  it('preloads on idle when preloadOn is "idle"', async () => {
    vi.useFakeTimers();
    const handler = vi.fn();
    const loader = vi.fn(() => Promise.resolve({ default: handler }));

    render(<TestComponent loader={loader} options={{ preloadOn: 'idle' }} />);

    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(handler).not.toHaveBeenCalled();
  });

  it('preloads via whichever of multiple strategies fires first, and ignores the rest', async () => {
    vi.useFakeTimers();
    const handler = vi.fn();
    const loader = vi.fn(() => Promise.resolve({ default: handler }));

    const { getByTestId } = render(
      <TestComponent loader={loader} options={{ preloadOn: ['hover', 'idle'] }} />,
    );
    const el = getByTestId('target');

    // Hover fires first — this alone should trigger exactly one load.
    await act(async () => {
      el.dispatchEvent(new Event('mouseenter', { bubbles: false }));
      await Promise.resolve();
    });

    expect(loader).toHaveBeenCalledTimes(1);

    // The idle timer firing afterward must be a no-op (already loaded).
    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('cancels the pending idle preload on unmount', async () => {
    vi.useFakeTimers();
    const handler = vi.fn();
    const loader = vi.fn(() => Promise.resolve({ default: handler }));

    const { unmount } = render(
      <TestComponent loader={loader} options={{ preloadOn: 'idle' }} />,
    );

    unmount();

    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });

    expect(loader).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/lazy-handler && pnpm exec vitest run test/use-lazy-handler.test.tsx`

Expected: the 3 new tests FAIL. `preloadOn is "idle"` and `cancels the pending idle preload` should fail with `expected "spy" to be called 1 times, but got 0 times` / already-passing-inverted respectively (TypeScript itself won't yet error because `options` is still typed loosely enough to accept the string, but the runtime hook doesn't implement `'idle'` yet, so no preload fires). The multi-strategy test should fail the same way. If any test errors instead of failing (e.g. a TypeScript compile error breaks the whole file), fix the error first, then re-run until you see real assertion failures.

- [ ] **Step 3: Update the type definitions**

Replace the full contents of `packages/lazy-handler/src/types.ts`:

```ts
/** A handler function that receives a DOM Event. May be async. */
export type HandlerFn = (event: Event) => void | Promise<void>;

export type Loader = () => Promise<{ default: HandlerFn }>;

export type PreloadStrategy = 'hover' | 'focus' | 'visible' | 'idle' | 'none';

export interface LazyHandlerOptions {
  event?: keyof HTMLElementEventMap;
  capture?: boolean;
  preloadOn?: PreloadStrategy | PreloadStrategy[];
}
```

- [ ] **Step 4: Implement `'idle'` and multi-strategy support in the hook**

Replace the full contents of `packages/lazy-handler/src/use-lazy-handler.ts`:

```ts
'use client';
import { useRef, useCallback, useEffect, useState } from 'react';
import type { HandlerFn, Loader, LazyHandlerOptions, PreloadStrategy } from './types';

// Map friendly preloadOn names to real DOM event names.
// 'hover' is not a DOM event; browsers fire 'mouseenter'/'mouseover'.
// 'focus' maps to 'focusin' so it also works on delegated containers.
const DOM_PRELOAD_EVENTS: Record<string, string> = {
  hover: 'mouseenter',
  focus: 'focusin',
};

export function useLazyHandler<T extends Element>(
  loader: Loader,
  options: LazyHandlerOptions = {},
): [(node: T | null) => void, (e: Event) => void] {
  const { event = 'click', capture = false, preloadOn = 'none' } = options;
  const strategies: PreloadStrategy[] = Array.isArray(preloadOn) ? preloadOn : [preloadOn];
  // Stable string key for the effect's dependency array. `strategies` is a
  // fresh array reference every render (options are usually passed as an
  // inline object/array literal), so depending on it directly would tear
  // down and re-arm every render. This key only changes when the actual
  // set of strategies changes.
  const strategiesKey = strategies.join(',');

  // A callback ref (backed by state) rather than a plain useRef: the target
  // element may mount after this hook's owning component's first render
  // (e.g. a button behind `open && items.length > 0`). A useRef wouldn't
  // trigger the effect below to re-run once that element actually appears.
  const [node, setNode] = useState<T | null>(null);
  const ref = useCallback((el: T | null) => setNode(el), []);
  const handlerRef = useRef<HandlerFn | null>(null);
  const loaderRef = useRef(loader);
  const loadingRef = useRef(false);
  // cancelledRef is set to true in effect cleanup so in-flight promises skip setState
  const cancelledRef = useRef(false);

  // Keep loader ref current without triggering effects (safe in 'use client')
  loaderRef.current = loader;

  const stub = useCallback((e: Event) => {
    e.stopImmediatePropagation();
    if (handlerRef.current) {
      handlerRef.current(e);
      return;
    }
    // Guard against double-load on rapid clicks while import() is in-flight
    if (loadingRef.current) return;
    loadingRef.current = true;
    // Capture currentTarget now — the browser resets it to null after dispatch.
    const capturedCurrentTarget = e.currentTarget;
    const asyncEvent = new Proxy(e, {
      get(target, prop, receiver) {
        if (prop === 'currentTarget') return capturedCurrentTarget;
        const val = Reflect.get(target, prop, receiver);
        return typeof val === 'function' ? (val as (...a: unknown[]) => unknown).bind(target) : val;
      },
    });
    loaderRef.current()
      .then((mod) => {
        if (cancelledRef.current) return;
        handlerRef.current = mod.default;
        loadingRef.current = false;
        mod.default(asyncEvent);
      })
      .catch(() => {
        loadingRef.current = false;
      });
  }, []);

  useEffect(() => {
    const el = node;
    if (!el) return;

    cancelledRef.current = false;

    const doPreload = () => {
      if (!handlerRef.current && !loadingRef.current) {
        loadingRef.current = true;
        loaderRef.current()
          .then((mod) => {
            if (!cancelledRef.current) {
              handlerRef.current = mod.default;
            }
            loadingRef.current = false;
          })
          .catch(() => {
            loadingRef.current = false;
          });
      }
    };

    el.addEventListener(event, stub, { capture });

    const teardowns: Array<() => void> = [];

    // strategiesKey (the effect dependency) is derived from `strategies`
    // via .join(','), so it's safe to read the freshly-computed
    // `strategies` array here — it always matches the key that triggered
    // this run.
    for (const strategy of strategies) {
      if (strategy === 'none') continue;

      if (strategy === 'visible') {
        if (typeof IntersectionObserver === 'undefined') continue;
        const obs = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              doPreload();
              obs.disconnect();
            }
          },
          { threshold: 0.1 },
        );
        obs.observe(el);
        teardowns.push(() => obs.disconnect());
        continue;
      }

      if (strategy === 'idle') {
        let id: ReturnType<typeof setTimeout>;
        if ('requestIdleCallback' in window) {
          id = requestIdleCallback(doPreload) as unknown as ReturnType<typeof setTimeout>;
          teardowns.push(() => cancelIdleCallback(id as unknown as number));
        } else {
          id = setTimeout(doPreload, 0);
          teardowns.push(() => clearTimeout(id));
        }
        continue;
      }

      // 'hover' | 'focus'
      const preloadEvent = DOM_PRELOAD_EVENTS[strategy] ?? strategy;
      el.addEventListener(preloadEvent, doPreload, { once: true });
      teardowns.push(() => el.removeEventListener(preloadEvent, doPreload));
    }

    return () => {
      cancelledRef.current = true;
      el.removeEventListener(event, stub, { capture });
      teardowns.forEach((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, event, capture, strategiesKey, stub]);

  return [ref, stub];
}
```

Note the `eslint-disable-next-line` comment: `strategies` itself isn't a hook dependency (only its stable `strategiesKey` string is) — this is intentional, per the comment above the `for` loop.

- [ ] **Step 5: Export `PreloadStrategy` from the package entry point**

In `packages/lazy-handler/src/index.ts`, change:

```ts
export type { LazyHandlerOptions, HandlerFn, Loader } from './types';
```

to:

```ts
export type { LazyHandlerOptions, HandlerFn, Loader, PreloadStrategy } from './types';
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/lazy-handler && pnpm exec vitest run`

Expected: all tests pass (16 existing + 3 new = 19 total), `3 passed` at the file level, `19 passed` at the test level. If `requestIdleCallback` turns out to exist in the Vitest/jsdom environment (making the `'requestIdleCallback' in window` branch run instead of the `setTimeout` fallback), the tests still pass as written — they only assert on `loader`/`handler` call counts, not on which branch fired.

- [ ] **Step 7: Type-check the package**

Run: `cd packages/lazy-handler && pnpm exec tsc --noEmit`

Expected: no output, exit code 0.

- [ ] **Step 8: Update the README**

In `README.md`, find this block (around line 68-74):

```
**Options**

| Option      | Type                        | Default   | Description            |
| ----------- | --------------------------- | --------- | ---------------------- |
| `event`     | `keyof HTMLElementEventMap` | `'click'` | DOM event to intercept |
| `capture`   | `boolean`                   | `false`   | Use capture phase      |
| `preloadOn` | `'hover'                    | 'focus'   | 'visible'              | 'none'` | `'none'` | Trigger an early prefetch before the user fires the real event |
```

Replace it with (fixes the pre-existing broken table row — the literal `|` characters inside the type union weren't escaped — and documents the new value and array form):

```
**Options**

| Option      | Type                                                             | Default   | Description                                                     |
| ----------- | ----------------------------------------------------------------- | --------- | ----------------------------------------------------------------- |
| `event`     | `keyof HTMLElementEventMap`                                      | `'click'` | DOM event to intercept                                           |
| `capture`   | `boolean`                                                        | `false`   | Use capture phase                                                 |
| `preloadOn` | `'hover' \| 'focus' \| 'visible' \| 'idle' \| 'none'`, or an array of these | `'none'`  | Trigger an early prefetch before the user fires the real event. An array arms multiple strategies at once — whichever fires first wins. |
```

Then find the `@bridge/lazy-handler` Gotchas section (around line 127-134):

```
### Gotchas

- `currentTarget` **is captured synchronously.** The browser nulls out `event.currentTarget` after the dispatch cycle. The stub captures it before the `import()` call and replays it on the async event via a `Proxy`, so your handler receives a correct `currentTarget` even though it runs after `await`.
- **Double-load guard is built in.** Rapid clicks while the module is in flight are deduplicated — the loader is called exactly once.
- **Each loader ref is stable.** You can pass an inline arrow function as `loader`; the hook holds a ref to the latest version without causing effect re-runs.
- **No SSR output.** The stub is never attached on the server. The element renders as static HTML until the client hydrates — which is the point.
- `preloadOn: 'visible'` **requires** `IntersectionObserver`**.** Falls back to no preload in environments that lack it (e.g. Node/jsdom test environments).
```

Add one more bullet at the end, after the `IntersectionObserver` bullet:

```
- `preloadOn: 'idle'` **needs no DOM event.** It schedules via `requestIdleCallback` (falling back to `setTimeout(fn, 0)` where unavailable) as soon as the element mounts. Pass an array (e.g. `preloadOn: ['hover', 'idle']`) to arm multiple strategies at once — the first one to fire loads the module; the rest become no-ops.
```

- [ ] **Step 9: Rebuild the package**

Run: `cd packages/lazy-handler && pnpm build`

Expected: `tsup` reports `ESM ⚡️ Build success`, `CJS ⚡️ Build success`, `DTS ⚡️ Build success`, exit code 0.

- [ ] **Step 10: Commit**

```bash
git add packages/lazy-handler/src/types.ts packages/lazy-handler/src/use-lazy-handler.ts packages/lazy-handler/src/index.ts packages/lazy-handler/test/use-lazy-handler.test.tsx packages/lazy-handler/dist README.md
git commit -m "$(cat <<'EOF'
feat(lazy-handler): add idle preload strategy and multi-strategy preloadOn

Lets a single lazy handler be preloaded on whichever of several triggers
(e.g. hover or browser idle time) fires first, mirroring
@bridge/hydration's existing idle strategy.
EOF
)"
```

---

### Task 2: Product Quick View modal (`apps/storefront`)

**Files:**
- Create: `apps/storefront/src/components/shared/handlers/quick-view.ts`
- Modify: `apps/storefront/src/components/shared/product-card.tsx`

**Interfaces:**
- Consumes: `useLazyHandler<T>(loader, options)` from `@bridge/lazy-handler/use-lazy-handler`, exactly as `ProductCard`'s existing Add to Cart button already does (Task 1's change is backward-compatible — `{ preloadOn: 'hover' }` still works unchanged). Consumes `Loader` type = `() => Promise<{ default: HandlerFn }>`, `HandlerFn` = `(event: Event) => void | Promise<void>`.
- Produces: nothing consumed by later tasks — this task and Task 3 are independent.

- [ ] **Step 1: Create the Quick View handler**

Create `apps/storefront/src/components/shared/handlers/quick-view.ts`:

```ts
// Loaded lazily via @bridge/lazy-handler when the user hovers "Quick View"
// or the browser goes idle, whichever happens first (see ProductCard's
// preloadOn: ['hover', 'idle']). Renders an imperative modal — no React
// state — same style as ./add-to-cart.ts and apps/host's
// ./handlers/start-checkout.ts.
//
// Dispatches the same 'bridge:cart:add' contract as ./add-to-cart.ts,
// duplicated inline rather than imported — see
// docs/superpowers/specs/2026-07-02-ecommerce-example-design.md,
// "Cross-widget cart sync", for why independently-loaded handler modules
// duplicate this tiny contract instead of sharing an import.
export default function openQuickView(event: Event): void {
  const button = event.currentTarget as HTMLButtonElement;
  const { id, name, price, color } = button.dataset;
  if (!id || !name || !price) return;
  const numericPrice = Number(price);

  const backdrop = document.createElement('div');
  backdrop.style.cssText =
    'position:fixed;inset:0;background:rgba(15,23,42,0.5);display:flex;' +
    'align-items:center;justify-content:center;z-index:1000;';

  const panel = document.createElement('div');
  panel.style.cssText =
    'background:#fff;border-radius:12px;padding:1.5rem;width:min(90vw,420px);' +
    'position:relative;box-shadow:0 20px 40px rgba(0,0,0,0.2);';

  function close() {
    document.removeEventListener('keydown', onKeydown);
    backdrop.remove();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', onKeydown);

  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.style.cssText =
    'position:absolute;top:0.75rem;right:0.75rem;border:none;background:transparent;' +
    'font-size:1.5rem;line-height:1;cursor:pointer;color:#64748b;';
  closeButton.addEventListener('click', close);

  const image = document.createElement('div');
  image.style.cssText = `height:200px;border-radius:8px;background:${color ?? '#e0e7ff'};margin-bottom:1rem;`;

  const heading = document.createElement('h3');
  heading.textContent = name;
  heading.style.cssText = 'margin:0 0 0.4rem;';

  const priceEl = document.createElement('p');
  priceEl.textContent = `$${numericPrice.toFixed(2)}`;
  priceEl.style.cssText = 'margin:0 0 0.75rem;color:#475569;font-weight:600;';

  const description = document.createElement('p');
  description.textContent = 'A closer look at this item — imagine a full product description here.';
  description.style.cssText = 'margin:0 0 1.25rem;color:#64748b;font-size:0.9rem;';

  const addToCartButton = document.createElement('button');
  addToCartButton.textContent = 'Add to Cart';
  addToCartButton.style.cssText =
    'width:100%;padding:0.6rem;background:#4f46e5;color:#fff;border:none;' +
    'border-radius:6px;cursor:pointer;font-size:0.95rem;';
  addToCartButton.addEventListener('click', () => {
    window.dispatchEvent(
      new CustomEvent('bridge:cart:add', {
        detail: { id, name, price: numericPrice },
      }),
    );
    addToCartButton.textContent = 'Added ✓';
    addToCartButton.disabled = true;
    setTimeout(close, 600);
  });

  panel.append(closeButton, image, heading, priceEl, description, addToCartButton);
  backdrop.append(panel);
  document.body.append(backdrop);
}
```

- [ ] **Step 2: Add the Quick View button to `ProductCard`**

Replace the full contents of `apps/storefront/src/components/shared/product-card.tsx`:

```tsx
import { createElement } from 'react';
import { useLazyHandler } from '@bridge/lazy-handler/use-lazy-handler';

export interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  color?: string;
}

// Chunk-bundled component — uses createElement (not JSX). Imports
// useLazyHandler from the dedicated './use-lazy-handler' subpath, never the
// package's main entry (which also contains Interactive/withLazyHandlers and
// their react/jsx-runtime import) — see this plan's Global Constraints for why.
export function ProductCard({ id, name, price, color = '#e0e7ff' }: ProductCardProps) {
  const [addToCartRef] = useLazyHandler<HTMLButtonElement>(
    () => import('./handlers/add-to-cart'),
    { preloadOn: 'hover' },
  );
  const [quickViewRef] = useLazyHandler<HTMLButtonElement>(
    () => import('./handlers/quick-view'),
    { preloadOn: ['hover', 'idle'] },
  );

  return createElement(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        padding: '1rem',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        width: 160,
      },
    },
    createElement('div', {
      style: { height: 100, background: color, borderRadius: 6 },
    }),
    createElement('strong', null, name),
    createElement('span', { style: { color: '#475569' } }, `$${price.toFixed(2)}`),
    createElement(
      'button',
      {
        ref: addToCartRef,
        'data-id': id,
        'data-name': name,
        'data-price': String(price),
        style: {
          padding: '0.5rem',
          background: '#4f46e5',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
        },
      },
      'Add to Cart',
    ),
    createElement(
      'button',
      {
        ref: quickViewRef,
        'data-id': id,
        'data-name': name,
        'data-price': String(price),
        'data-color': color,
        style: {
          padding: '0.5rem',
          background: '#fff',
          color: '#4f46e5',
          border: '1px solid #4f46e5',
          borderRadius: 6,
          cursor: 'pointer',
        },
      },
      'Quick View',
    ),
  );
}
```

- [ ] **Step 3: Type-check the storefront app**

Run: `cd apps/storefront && pnpm exec tsc --noEmit`

Expected: no output, exit code 0.

- [ ] **Step 4: Rebuild the storefront's chunks**

Run: `cd apps/storefront && pnpm build:chunks`

Expected: `tsup` output listing `public/homewidget.chunk.js`, `public/popularproductspanel.chunk.js`, a new hashed `public/quick-view-XXXXXXXX.chunk.js`, plus the existing `add-to-cart-*.chunk.js` — all `⚡️ Build success`.

- [ ] **Step 5: Commit**

```bash
git add apps/storefront/src/components/shared/handlers/quick-view.ts apps/storefront/src/components/shared/product-card.tsx apps/storefront/public
git commit -m "$(cat <<'EOF'
feat(storefront): add Quick View modal, preloaded on hover or idle

Demonstrates @bridge/lazy-handler's new multi-strategy preloadOn: the
modal's handler chunk loads on whichever of hover-on-trigger or browser
idle time happens first.
EOF
)"
```

---

### Task 3: Categories hover mega-menu (`apps/web`)

**Files:**
- Create: `apps/web/app/demo/ecommerce/handlers/open-categories-menu.ts`
- Modify: `apps/web/app/demo/ecommerce/components/header.tsx`

**Interfaces:**
- Consumes: same `useLazyHandler` import path and signature as Task 2 (`@bridge/lazy-handler/use-lazy-handler`).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Create the categories menu handler**

Create `apps/web/app/demo/ecommerce/handlers/open-categories-menu.ts`:

```ts
// Loaded lazily via @bridge/lazy-handler on hover of the "Categories" nav
// item. Shell-owned (not a @bridge/share remote widget) — nav chrome is
// the shell's own concern, same reasoning as <Header>/<Footer> themselves
// not being remote components. Imperative DOM, same style as
// apps/storefront's and apps/host's handlers.
const CATEGORIES = ['Footwear', 'Bags', 'Accessories', 'Home Goods'];

export default function openCategoriesMenu(event: Event): void {
  const trigger = event.currentTarget as HTMLButtonElement;
  const rect = trigger.getBoundingClientRect();

  const menu = document.createElement('div');
  menu.style.cssText =
    `position:fixed;top:${rect.bottom + 6}px;left:${rect.left}px;` +
    'background:#fff;border:1px solid #e2e8f0;border-radius:8px;' +
    'box-shadow:0 4px 12px rgba(0,0,0,0.08);padding:0.5rem;min-width:160px;z-index:1000;';

  for (const category of CATEGORIES) {
    const link = document.createElement('a');
    link.href = '#';
    link.textContent = category;
    link.style.cssText =
      'display:block;padding:0.4rem 0.6rem;color:#334155;text-decoration:none;' +
      'font-size:0.9rem;border-radius:4px;';
    link.addEventListener('mouseenter', () => {
      link.style.background = '#f1f5f9';
    });
    link.addEventListener('mouseleave', () => {
      link.style.background = 'transparent';
    });
    link.addEventListener('click', (e) => e.preventDefault());
    menu.append(link);
  }

  function close() {
    document.removeEventListener('keydown', onKeydown);
    document.removeEventListener('click', onOutsideClick);
    menu.remove();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  function onOutsideClick(e: MouseEvent) {
    if (!menu.contains(e.target as Node) && e.target !== trigger) close();
  }

  document.addEventListener('keydown', onKeydown);
  // Deferred one tick so the click that opened the menu (if this fired via
  // click rather than a pure hover-preload-then-click) doesn't immediately
  // close it via onOutsideClick.
  setTimeout(() => document.addEventListener('click', onOutsideClick), 0);

  document.body.append(menu);
}
```

- [ ] **Step 2: Wire the button into the header**

Replace the full contents of `apps/web/app/demo/ecommerce/components/header.tsx`:

```tsx
'use client';
import { HydrationBoundary } from '@bridge/hydration';
import { RemoteComponent } from '@bridge/share';
import { useLazyHandler } from '@bridge/lazy-handler/use-lazy-handler';
import { StaticCartIcon } from './static-cart-icon';

const HOST_MANIFEST = 'http://localhost:3001/share-manifest.json';

export function Header() {
  const [categoriesRef] = useLazyHandler<HTMLButtonElement>(
    () => import('../handlers/open-categories-menu'),
    { preloadOn: 'hover' },
  );

  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 1.5rem',
        borderBottom: '1px solid #e2e8f0',
      }}
    >
      <strong style={{ fontSize: '1.1rem' }}>bridges • shop</strong>
      <nav style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem', color: '#475569' }}>
        <span>Home</span>
        <button
          ref={categoriesRef}
          style={{
            font: 'inherit',
            color: 'inherit',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          Categories
        </button>
        <span>Deals</span>
      </nav>
      <HydrationBoundary strategy="idle" fallback={<StaticCartIcon />}>
        <RemoteComponent
          manifestUrl={HOST_MANIFEST}
          expose="./CartWidget"
          fallback={<StaticCartIcon />}
          errorFallback={<StaticCartIcon />}
        />
      </HydrationBoundary>
    </header>
  );
}
```

- [ ] **Step 3: Type-check the web app**

Run: `cd apps/web && pnpm exec tsc --noEmit`

Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/demo/ecommerce/handlers/open-categories-menu.ts apps/web/app/demo/ecommerce/components/header.tsx
git commit -m "$(cat <<'EOF'
feat(web): add hover-preloaded Categories mega-menu to the shell header

A second, shell-owned lazy-hover example alongside the storefront's Quick
View modal — nav chrome lazy-loaded on hover, not a @bridge/share widget.
EOF
)"
```

---

### Task 4: End-to-end verification

**Files:** none (verification only, no code changes).

**Interfaces:** none.

- [ ] **Step 1: Start all three apps**

In three separate terminals from the repo root (do not use `pnpm dev` / `turbo dev` — see `README.md`'s Troubleshooting section for why that may be blocked on this machine):

```bash
pnpm --filter host dev
pnpm --filter storefront dev
pnpm --filter web dev
```

Wait for all three to print `✓ Ready` (`host` on :3001, `storefront` on :3002, `web` on :3000; if :3000 is taken, note the fallback port Next.js prints).

- [ ] **Step 2: Verify Quick View — hover preload**

Open `http://localhost:3000/demo/ecommerce` in a fresh browser tab (or hard-reload if apps were already running, since chunk filenames without a content hash can be browser-cached from a prior session — the ones here, `quick-view-*.chunk.js`, do have a content hash from tsup, so a normal reload is sufficient). Open DevTools Network tab, filter by `quick-view`. Hover (don't click) any product's "Quick View" button. Confirm the `quick-view-*.chunk.js` request appears in the Network tab before any click.

- [ ] **Step 3: Verify Quick View — idle preload**

Reload the page. Without hovering or clicking anything, wait ~2 seconds. Confirm the same `quick-view-*.chunk.js` request appears in the Network tab (triggered by `requestIdleCallback`/`setTimeout` fallback, not user interaction).

- [ ] **Step 4: Verify Quick View — modal content and interactions**

Click "Quick View" on the "Trail Sneakers" card. Confirm:
- A modal appears with "Trail Sneakers", "$79.99", the pink color block, and an "Add to Cart" button.
- Pressing Escape closes it.
- Reopening it and clicking outside the panel (on the dark backdrop) closes it.
- Reopening it and clicking "×" closes it.
- Reopening it and clicking "Add to Cart" inside the modal: the header's cart badge count increments by 1, the modal's button briefly shows "Added ✓", and the modal closes shortly after.

- [ ] **Step 5: Verify the Categories mega-menu**

Reload the page. Hover "Categories" in the header nav. Confirm a dropdown appears below it listing "Footwear", "Bags", "Accessories", "Home Goods". Click elsewhere on the page and confirm the menu closes. Reopen it and press Escape — confirm it closes.

- [ ] **Step 6: Regression-check the existing checkout flow**

Add an item to the cart, open the cart dropdown, click "Proceed to Checkout". Confirm it still shows "✓ Checkout started" and becomes disabled (this is the bug fixed earlier this session — confirms Task 1's hook rewrite didn't regress it, since `CartWidget`'s checkout button also depends on `useLazyHandler`).

- [ ] **Step 7: Run the full test suite**

Run from the repo root: `pnpm test`

Expected: all package test suites pass, including `packages/lazy-handler`'s 19 tests.

No commit for this task — it's verification only. If any step fails, return to the relevant task, fix, and re-run this task's steps from the top.
