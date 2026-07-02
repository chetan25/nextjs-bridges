# E-Commerce Bridges Example Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/demo/ecommerce` page in `apps/web` that composes a realistic multi-team storefront — a Shell-owned Header/Footer, a Checkout team's `CartWidget`, and a Home/Recommendations team's `HomeWidget` + `PopularProductsPanel` — using all three bridges (`@bridge/share` to load the remote widgets, `@bridge/hydration` to defer their mount, `@bridge/lazy-handler` to defer their interaction JS) together in one meaningful scenario.

**Architecture:** A new app `apps/storefront` (port 3002) is scaffolded identically to the existing `apps/host` (port 3001), each exposing components via `@bridge/share`. `apps/host` gains a new `./CartWidget` expose alongside its existing `./Button`. `apps/storefront` exposes `./HomeWidget` and `./PopularProductsPanel`. `apps/web` composes all three into one page via `<RemoteComponent>`, wrapping two of them in `<HydrationBoundary>`. Product cards inside the remote widgets use `@bridge/lazy-handler`'s `useLazyHandler` to defer their "Add to Cart" handler JS; that handler dispatches a `window` `CustomEvent` that `CartWidget` — a separate React root, possibly a separate app — listens for, since no React context can cross that boundary.

**Tech Stack:** TypeScript, Next.js 15 (Turbopack for app builds), tsup/esbuild (chunk builds), pnpm workspaces, Turbo.

## Global Constraints

- Any component file that ends up bundled into a `@bridge/share` chunk (i.e. anything under `apps/host/src/components/**` or `apps/storefront/src/components/**`) must build markup with `createElement` from `'react'`, never JSX. These files compile through `apps/host/tsup.config.ts` / `apps/storefront/tsup.config.ts`'s esbuild pipeline with the react-alias mechanism from the prior shared-dep-externalization work; `apps/host/src/components/button.tsx` already establishes this pattern and is verified working. (Files under `apps/web/**` are ordinary Next.js Client Components compiled by Next's own toolchain and use normal JSX.)
- Inside any chunk-bundled component, only import `useLazyHandler` from `@bridge/lazy-handler` — never `Interactive` or `withLazyHandlers`. Both of those compile to calls into `react/jsx-runtime` (confirmed in `packages/lazy-handler/dist/index.mjs`), a module specifier the project's existing react-alias shims do not cover. `useLazyHandler` itself contains no JSX and has no such import.
- `apps/host`'s existing `./Button` expose and the existing `/demo/lazy-handler`, `/demo/hydration`, and `/demo/share` pages must keep working unmodified throughout this plan.
- `apps/storefront` mirrors `apps/host`'s existing file conventions (`package.json` script names, `tsup.config.ts`'s shim-aliasing logic, `next.config.ts`'s `shareConfig()` usage) exactly, so it participates in the shared-dep-externalization mechanism the same way `apps/host` does.
- Cross-widget cart sync uses a plain `window` `CustomEvent` named `'bridge:cart:add'` with a duplicated (not shared/imported) `{ id: string; name: string; price: number }` payload shape on both the dispatching and listening sides — no new package or shared type.
- All new UI uses inline `style={{ ... }}` objects, matching the existing convention in `apps/web/app/demo/*` (no CSS framework, no new classes beyond what already exists).
- Spec reference: `docs/superpowers/specs/2026-07-02-ecommerce-example-design.md`.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `apps/storefront/package.json` | Create | New app manifest, port 3002 |
| `apps/storefront/tsconfig.json` | Create | Mirrors `apps/host/tsconfig.json` |
| `apps/storefront/next-env.d.ts` | Create | Standard Next.js generated stub |
| `apps/storefront/next.config.ts` | Create | `shareConfig()` exposing `./HomeWidget`, `./PopularProductsPanel` |
| `apps/storefront/tsup.config.ts` | Create | Chunk build config, mirrors `apps/host`'s shim-aliasing logic |
| `apps/storefront/app/layout.tsx` | Create | Minimal root layout |
| `apps/storefront/app/page.tsx` | Create | Minimal stub page (mirrors `apps/host/app/page.tsx`) |
| `apps/storefront/src/components/home-team/home-widget.tsx` | Create (stub, then replace) | Home team's exposed widget |
| `apps/storefront/src/components/recommendations-team/popular-products-panel.tsx` | Create (stub, then replace) | Recommendations team's exposed widget |
| `apps/storefront/src/components/shared/product-card.tsx` | Create | Shared placeholder product card + lazy Add to Cart |
| `apps/storefront/src/components/shared/handlers/add-to-cart.ts` | Create | Lazily-loaded handler; dispatches `bridge:cart:add` |
| `apps/host/package.json` | Modify | Add `@bridge/lazy-handler` dependency |
| `apps/host/next.config.ts` | Modify | Add `./CartWidget` to `exposes` |
| `apps/host/tsup.config.ts` | Modify | Add `cart-widget` entry, extend `noExternal` |
| `apps/host/src/components/checkout-team/cart-widget.tsx` | Create | Checkout team's cart icon/dropdown; listens for `bridge:cart:add` |
| `apps/host/src/components/checkout-team/handlers/start-checkout.ts` | Create | Lazily-loaded "Proceed to Checkout" handler |
| `turbo.json` | Modify | Add `storefront#build` ordering override |
| `apps/web/app/demo/ecommerce/page.tsx` | Create | Composes the full e-commerce page |
| `apps/web/app/demo/ecommerce/components/header.tsx` | Create | Shell-owned header with `CartWidget` slot |
| `apps/web/app/demo/ecommerce/components/footer.tsx` | Create | Shell-owned static footer |
| `apps/web/app/demo/ecommerce/components/static-cart-icon.tsx` | Create | Hydration/error fallback for `CartWidget` |
| `apps/web/app/demo/ecommerce/components/panel-skeleton.tsx` | Create | Hydration fallback for `PopularProductsPanel` |
| `apps/web/app/page.tsx` | Modify | Add nav link to `/demo/ecommerce` |
| `README.md` | Modify | Document the new example and `apps/storefront` |

---

## Task 1: Scaffold `apps/storefront`

**Files:**
- Create: `apps/storefront/package.json`, `apps/storefront/tsconfig.json`, `apps/storefront/next-env.d.ts`, `apps/storefront/next.config.ts`, `apps/storefront/tsup.config.ts`, `apps/storefront/app/layout.tsx`, `apps/storefront/app/page.tsx`, `apps/storefront/src/components/home-team/home-widget.tsx`, `apps/storefront/src/components/recommendations-team/popular-products-panel.tsx`

**Interfaces:**
- Produces: a working app on port 3002 that builds two chunks (`home-widget.chunk.js`, `popular-products-panel.chunk.js`) and a `share-manifest.json`, mirroring `apps/host`'s existing build.

- [ ] **Step 1: Create the package manifest**

```json
// apps/storefront/package.json
{
  "name": "storefront",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack --port 3002",
    "build": "pnpm build:chunks && next build",
    "build:chunks": "tsup",
    "start": "next start --port 3002",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@bridge/share": "workspace:*",
    "next": "^15.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@bridge/tsconfig": "workspace:*",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "tsup": "^8.0.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create the TypeScript config**

```json
// apps/storefront/tsconfig.json
{
  "extends": "@bridge/tsconfig/base.json",
  "compilerOptions": {
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": [
        "./*"
      ]
    },
    "noEmit": true,
    "allowJs": true,
    "incremental": true,
    "jsx": "preserve"
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

- [ ] **Step 3: Create the Next.js generated env stub**

```ts
// apps/storefront/next-env.d.ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
/// <reference path="./.next/types/routes.d.ts" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

- [ ] **Step 4: Create the root layout**

```tsx
// apps/storefront/app/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '@bridge/share storefront app',
  description: 'Storefront app exposing HomeWidget and PopularProductsPanel via @bridge/share',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Create the stub index page**

```tsx
// apps/storefront/app/page.tsx
export default function StorefrontHomePage() {
  return (
    <main>
      <h1>@bridge/share storefront</h1>
      <p>
        This app exposes shared components via <code>/share-manifest.json</code>.
      </p>
    </main>
  );
}
```

- [ ] **Step 6: Create the `next.config.ts`**

```ts
// apps/storefront/next.config.ts
import type { NextConfig } from 'next';
import { shareConfig } from '@bridge/share/next-config-helper';

const nextConfig: NextConfig = {
  // Allow cross-origin requests so apps/web (port 3000) can load
  // the manifest and chunk files served by this app (port 3002).
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
  name: 'storefront-app',
  version: '1.0.0',
  baseUrl: 'http://localhost:3002',
  exposes: {
    './HomeWidget': './src/components/home-team/home-widget.tsx',
    './PopularProductsPanel': './src/components/recommendations-team/popular-products-panel.tsx',
  },
  shared: { react: {}, 'react-dom': {} },
  sharedContractPath: '../../packages/share/shared-contract.json',
})(nextConfig);
```

- [ ] **Step 7: Create the `tsup.config.ts`**

```ts
// apps/storefront/tsup.config.ts
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
  entry: {
    'home-widget': 'src/components/home-team/home-widget.tsx',
    'popular-products-panel': 'src/components/recommendations-team/popular-products-panel.tsx',
  },
  format: ['esm'],
  outDir: 'public',
  outExtension: () => ({ js: '.chunk.js' }),
  platform: 'browser',
  target: 'es2022',
  sourcemap: false,
  dts: false,
  clean: false,
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

- [ ] **Step 8: Create the Home team's stub widget**

```tsx
// apps/storefront/src/components/home-team/home-widget.tsx
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

type MountFunction = (
  container: HTMLElement,
  props: Record<string, unknown>,
) => () => void;

function HomeWidget() {
  return createElement(
    'div',
    { style: { padding: '2rem', background: '#eef2ff', borderRadius: 12 } },
    createElement('h1', { style: { margin: 0 } }, 'Home team widget — scaffold OK'),
  );
}

const mount: MountFunction = (container, props) => {
  const root = createRoot(container);
  root.render(createElement(HomeWidget, props));
  return () => root.unmount();
};

export default mount;
```

- [ ] **Step 9: Create the Recommendations team's stub widget**

```tsx
// apps/storefront/src/components/recommendations-team/popular-products-panel.tsx
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

type MountFunction = (
  container: HTMLElement,
  props: Record<string, unknown>,
) => () => void;

function PopularProductsPanel() {
  return createElement(
    'div',
    { style: { padding: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12 } },
    createElement('h2', { style: { margin: 0, fontSize: '1.1rem' } }, 'Recommendations team widget — scaffold OK'),
  );
}

const mount: MountFunction = (container, props) => {
  const root = createRoot(container);
  root.render(createElement(PopularProductsPanel, props));
  return () => root.unmount();
};

export default mount;
```

- [ ] **Step 10: Install dependencies**

Run: `pnpm install`
Expected: lockfile updates to include the new `storefront` workspace member, no errors.

- [ ] **Step 11: Build the new app standalone and verify output**

Run: `pnpm --filter storefront build`
Expected: succeeds; `apps/storefront/public/home-widget.chunk.js`, `apps/storefront/public/popular-products-panel.chunk.js`, and `apps/storefront/public/share-manifest.json` all exist. `cat apps/storefront/public/share-manifest.json` shows both `./HomeWidget` and `./PopularProductsPanel` under `exposes`.

- [ ] **Step 12: Type-check**

Run: `pnpm --filter storefront type-check`
Expected: PASS

- [ ] **Step 13: Commit**

```bash
git add apps/storefront pnpm-lock.yaml
git commit -m "feat(storefront): scaffold new app exposing HomeWidget and PopularProductsPanel stubs"
```

---

## Task 2: Build ordering for `apps/storefront`

**Files:**
- Modify: `turbo.json`

**Interfaces:**
- Consumes: nothing new.
- Produces: `apps/storefront`'s build runs only after `apps/web`'s build, same reasoning as the existing `host#build` override.

- [ ] **Step 1: Add the override**

```jsonc
// turbo.json — add alongside the existing "host#build" entry
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
    "storefront#build": {
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

- [ ] **Step 2: Verify a full root build orders correctly**

Run: `pnpm build`
Expected: succeeds; `apps/web`'s build runs before `apps/host`'s and `apps/storefront`'s (both of which may run in parallel with each other).

- [ ] **Step 3: Commit**

```bash
git add turbo.json
git commit -m "build: order apps/storefront's build after apps/web's"
```

---

## Task 3: `ProductCard` + lazy Add to Cart, wired into `HomeWidget`

**Files:**
- Modify: `apps/storefront/package.json`, `apps/storefront/tsup.config.ts`, `apps/storefront/src/components/home-team/home-widget.tsx`
- Create: `apps/storefront/src/components/shared/product-card.tsx`, `apps/storefront/src/components/shared/handlers/add-to-cart.ts`

**Interfaces:**
- Consumes: `useLazyHandler` from `@bridge/lazy-handler`.
- Produces: `export function ProductCard({ id, name, price, color }: ProductCardProps)`; default-exported `addToCart(event: Event): void` in `add-to-cart.ts`, which dispatches `window.dispatchEvent(new CustomEvent('bridge:cart:add', { detail: { id, name, price } }))`.

- [ ] **Step 1: Add the `@bridge/lazy-handler` dependency**

```json
// apps/storefront/package.json — add to "dependencies", alongside "@bridge/share"
"@bridge/lazy-handler": "workspace:*",
```

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: succeeds, no errors.

- [ ] **Step 3: Extend `tsup.config.ts`'s `noExternal`**

```ts
// apps/storefront/tsup.config.ts — change this line:
noExternal: [/react/],
// to this:
noExternal: [/react/, '@bridge/lazy-handler'],
```

`@bridge/lazy-handler` is a `package.json` dependency, so tsup would otherwise leave a bare `import ... from "@bridge/lazy-handler"` unresolved in the output (tsup's default is to externalize any declared dependency). This forces it to be bundled directly into the chunk instead — it is never aliased/shimmed like react/react-dom, since it isn't a singleton concern.

- [ ] **Step 4: Create the add-to-cart handler**

```ts
// apps/storefront/src/components/shared/handlers/add-to-cart.ts
// Loaded lazily via @bridge/lazy-handler on first "Add to Cart" click.
// Publishes to window so apps/host's CartWidget (a separate React root,
// a separate app) can react — see
// apps/host/src/components/checkout-team/cart-widget.tsx, which listens
// for this same event name and payload shape by convention, not by import.
export interface CartAddEventDetail {
  id: string;
  name: string;
  price: number;
}

export default function addToCart(event: Event): void {
  const button = event.currentTarget as HTMLButtonElement;
  const { id, name, price } = button.dataset;
  if (!id || !name || !price) return;

  window.dispatchEvent(
    new CustomEvent<CartAddEventDetail>('bridge:cart:add', {
      detail: { id, name, price: Number(price) },
    }),
  );

  button.textContent = 'Added ✓';
  button.disabled = true;
  setTimeout(() => {
    button.textContent = 'Add to Cart';
    button.disabled = false;
  }, 1200);
}
```

- [ ] **Step 5: Create `ProductCard`**

```tsx
// apps/storefront/src/components/shared/product-card.tsx
import { createElement } from 'react';
import { useLazyHandler } from '@bridge/lazy-handler';

export interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  color?: string;
}

// Chunk-bundled component — uses createElement (not JSX) and only
// useLazyHandler (not <Interactive>/withLazyHandlers) from @bridge/lazy-handler.
// See this plan's Global Constraints for why.
export function ProductCard({ id, name, price, color = '#e0e7ff' }: ProductCardProps) {
  const [ref] = useLazyHandler<HTMLButtonElement>(
    () => import('./handlers/add-to-cart'),
    { preloadOn: 'hover' },
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
        ref,
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
  );
}
```

- [ ] **Step 6: Replace `home-widget.tsx`'s stub with the real widget**

```tsx
// apps/storefront/src/components/home-team/home-widget.tsx — replace entire file
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { ProductCard, type ProductCardProps } from '../shared/product-card';

interface Props {
  products?: ProductCardProps[];
}

const DEFAULT_PRODUCTS: ProductCardProps[] = [
  { id: 'p1', name: 'Trail Sneakers', price: 79.99, color: '#fecaca' },
  { id: 'p2', name: 'Canvas Tote', price: 24.5, color: '#bbf7d0' },
  { id: 'p3', name: 'Wool Beanie', price: 18.0, color: '#bfdbfe' },
  { id: 'p4', name: 'Ceramic Mug', price: 14.25, color: '#fde68a' },
];

type MountFunction = (
  container: HTMLElement,
  props: Record<string, unknown>,
) => () => void;

function HomeWidget({ products = DEFAULT_PRODUCTS }: Props) {
  return createElement(
    'section',
    { style: { display: 'flex', flexDirection: 'column', gap: '1rem' } },
    createElement(
      'div',
      {
        style: {
          padding: '2rem',
          background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
          color: '#fff',
          borderRadius: 12,
        },
      },
      createElement('h1', { style: { margin: 0 } }, 'Summer Essentials'),
      createElement(
        'p',
        { style: { margin: '0.5rem 0 0' } },
        'Owned by the Home team — loaded from apps/storefront',
      ),
    ),
    createElement(
      'div',
      { style: { display: 'flex', gap: '1rem', flexWrap: 'wrap' } },
      ...products.map((p) => createElement(ProductCard, { key: p.id, ...p })),
    ),
  );
}

const mount: MountFunction = (container, props) => {
  const root = createRoot(container);
  root.render(createElement(HomeWidget, props as Props));
  return () => root.unmount();
};

export default mount;
```

- [ ] **Step 7: Build and verify code-splitting produced a separate handler chunk**

Run: `pnpm --filter storefront build:chunks`
Expected: succeeds. Then run: `ls apps/storefront/public`
Expected: alongside `home-widget.chunk.js`, `popular-products-panel.chunk.js`, and `share-manifest.json`, at least one additional file matching `add-to-cart*.chunk.js` (tsup/esbuild code-splits dynamic `import()` targets into separate output files by default for ESM format, and `outExtension` applies the same `.chunk.js` suffix to every emitted file, so this split file also matches the existing CORS header pattern in `next.config.ts`). If no such file appears, add `splitting: true` to the `defineConfig({...})` object in `apps/storefront/tsup.config.ts` and rerun this step.

- [ ] **Step 8: Verify no unaliased `react/jsx-runtime` leaked into the bundled chunk**

Run: `grep -c "jsx-runtime" apps/storefront/public/home-widget.chunk.js`
Expected: `0`. If nonzero, check that `product-card.tsx` and `add-to-cart.ts` only import `useLazyHandler` (not `Interactive`/`withLazyHandlers`) from `@bridge/lazy-handler`.

- [ ] **Step 9: Type-check**

Run: `pnpm --filter storefront type-check`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add apps/storefront/package.json apps/storefront/tsup.config.ts apps/storefront/src/components/home-team/home-widget.tsx apps/storefront/src/components/shared pnpm-lock.yaml
git commit -m "feat(storefront): add ProductCard and lazy-loaded add-to-cart handler, wire into HomeWidget"
```

---

## Task 4: Wire `PopularProductsPanel` to use `ProductCard`

**Files:**
- Modify: `apps/storefront/src/components/recommendations-team/popular-products-panel.tsx`

**Interfaces:**
- Consumes: `ProductCard`, `ProductCardProps` from `../shared/product-card` (Task 3).

- [ ] **Step 1: Replace the stub with the real panel**

```tsx
// apps/storefront/src/components/recommendations-team/popular-products-panel.tsx — replace entire file
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { ProductCard, type ProductCardProps } from '../shared/product-card';

interface Props {
  products?: ProductCardProps[];
}

const DEFAULT_PRODUCTS: ProductCardProps[] = [
  { id: 'r1', name: 'Insulated Bottle', price: 22.0, color: '#c7d2fe' },
  { id: 'r2', name: 'Desk Plant', price: 12.99, color: '#a7f3d0' },
  { id: 'r3', name: 'Notebook Set', price: 9.5, color: '#fbcfe8' },
];

type MountFunction = (
  container: HTMLElement,
  props: Record<string, unknown>,
) => () => void;

function PopularProductsPanel({ products = DEFAULT_PRODUCTS }: Props) {
  return createElement(
    'section',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        padding: '1rem',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        background: '#f8fafc',
      },
    },
    createElement('h2', { style: { margin: 0, fontSize: '1.1rem' } }, '🔥 Popular Right Now'),
    createElement(
      'p',
      { style: { margin: 0, fontSize: '0.8rem', color: '#64748b' } },
      'Owned by the Recommendations team — loaded from apps/storefront',
    ),
    createElement(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '0.75rem' } },
      ...products.map((p) => createElement(ProductCard, { key: p.id, ...p })),
    ),
  );
}

const mount: MountFunction = (container, props) => {
  const root = createRoot(container);
  root.render(createElement(PopularProductsPanel, props as Props));
  return () => root.unmount();
};

export default mount;
```

- [ ] **Step 2: Build and verify**

Run: `pnpm --filter storefront build`
Expected: succeeds; `apps/storefront/public/popular-products-panel.chunk.js` rebuilds without error.

- [ ] **Step 3: Type-check**

Run: `pnpm --filter storefront type-check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/storefront/src/components/recommendations-team/popular-products-panel.tsx
git commit -m "feat(storefront): wire PopularProductsPanel to use ProductCard"
```

---

## Task 5: `CartWidget` in `apps/host`

**Files:**
- Modify: `apps/host/package.json`, `apps/host/next.config.ts`, `apps/host/tsup.config.ts`
- Create: `apps/host/src/components/checkout-team/cart-widget.tsx`, `apps/host/src/components/checkout-team/handlers/start-checkout.ts`

**Interfaces:**
- Consumes: `useLazyHandler` from `@bridge/lazy-handler`; listens for the `'bridge:cart:add'` window event dispatched by Task 3's `add-to-cart.ts` (payload: `{ id: string; name: string; price: number }`, duplicated type per this plan's Global Constraints).
- Produces: `apps/host`'s manifest gains a `./CartWidget` expose alongside the existing `./Button`.

- [ ] **Step 1: Add the `@bridge/lazy-handler` dependency**

```json
// apps/host/package.json — add to "dependencies", alongside "@bridge/share"
"@bridge/lazy-handler": "workspace:*",
```

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: succeeds, no errors.

- [ ] **Step 3: Add the expose to `next.config.ts`**

```ts
// apps/host/next.config.ts — change the exposes object from:
exposes: {
  './Button': './src/components/button.tsx',
},
// to:
exposes: {
  './Button': './src/components/button.tsx',
  './CartWidget': './src/components/checkout-team/cart-widget.tsx',
},
```

- [ ] **Step 4: Add the entry and extend `noExternal` in `tsup.config.ts`**

```ts
// apps/host/tsup.config.ts — change the entry object from:
entry: { button: 'src/components/button.tsx' },
// to:
entry: {
  button: 'src/components/button.tsx',
  'cart-widget': 'src/components/checkout-team/cart-widget.tsx',
},
```

```ts
// apps/host/tsup.config.ts — change this line:
noExternal: [/react/],
// to this:
noExternal: [/react/, '@bridge/lazy-handler'],
```

- [ ] **Step 5: Create the "Proceed to Checkout" handler**

```ts
// apps/host/src/components/checkout-team/handlers/start-checkout.ts
// Loaded lazily via @bridge/lazy-handler when the user hovers or clicks
// "Proceed to Checkout" in CartWidget. Simulates kicking off a real checkout
// flow module — this demo only updates the button to show it fired.
export default function startCheckout(event: Event): void {
  const button = event.currentTarget as HTMLButtonElement;
  button.textContent = '✓ Checkout started';
  button.disabled = true;
  button.style.background = '#94a3b8';
  button.style.cursor = 'default';
}
```

- [ ] **Step 6: Create `CartWidget`**

```tsx
// apps/host/src/components/checkout-team/cart-widget.tsx
import { createElement, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useLazyHandler } from '@bridge/lazy-handler';

interface CartItem {
  id: string;
  name: string;
  price: number;
}

// Payload shape agreed by convention with apps/storefront's add-to-cart
// handler (apps/storefront/src/components/shared/handlers/add-to-cart.ts) —
// duplicated rather than imported from a shared package, since two
// independently-deployed teams coordinate on an event name + shape, not a
// compiler-checked type. See
// docs/superpowers/specs/2026-07-02-ecommerce-example-design.md.
interface CartAddEventDetail {
  id: string;
  name: string;
  price: number;
}

type MountFunction = (
  container: HTMLElement,
  props: Record<string, unknown>,
) => () => void;

function CartWidget() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onAdd(e: Event) {
      const { detail } = e as CustomEvent<CartAddEventDetail>;
      setItems((prev) => [...prev, detail]);
    }
    window.addEventListener('bridge:cart:add', onAdd);
    return () => window.removeEventListener('bridge:cart:add', onAdd);
  }, []);

  const [checkoutRef] = useLazyHandler<HTMLButtonElement>(
    () => import('./handlers/start-checkout'),
    { preloadOn: 'hover' },
  );

  const total = items.reduce((sum, item) => sum + item.price, 0);

  return createElement(
    'div',
    { style: { position: 'relative', fontFamily: 'inherit' } },
    createElement(
      'button',
      {
        onClick: () => setOpen((o) => !o),
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.5rem 0.75rem',
          background: '#fff',
          border: '1px solid #cbd5e1',
          borderRadius: 8,
          cursor: 'pointer',
        },
      },
      '🛒',
      createElement(
        'span',
        {
          style: {
            background: '#4f46e5',
            color: '#fff',
            borderRadius: 999,
            fontSize: '0.75rem',
            padding: '0.1rem 0.45rem',
          },
        },
        String(items.length),
      ),
    ),
    open &&
      createElement(
        'div',
        {
          style: {
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '0.4rem',
            width: 220,
            padding: '0.75rem',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          },
        },
        items.length === 0
          ? createElement(
              'p',
              { style: { margin: 0, color: '#64748b', fontSize: '0.85rem' } },
              'Cart is empty',
            )
          : createElement(
              'ul',
              {
                style: {
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem',
                },
              },
              ...items.map((item, i) =>
                createElement(
                  'li',
                  {
                    key: `${item.id}-${i}`,
                    style: { display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' },
                  },
                  createElement('span', null, item.name),
                  createElement('span', null, `$${item.price.toFixed(2)}`),
                ),
              ),
            ),
        items.length > 0 &&
          createElement(
            'button',
            {
              ref: checkoutRef,
              style: {
                marginTop: '0.6rem',
                width: '100%',
                padding: '0.5rem',
                background: '#16a34a',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              },
            },
            `Proceed to Checkout ($${total.toFixed(2)})`,
          ),
      ),
  );
}

const mount: MountFunction = (container, props) => {
  const root = createRoot(container);
  root.render(createElement(CartWidget, props));
  return () => root.unmount();
};

export default mount;
```

- [ ] **Step 7: Build and verify both host chunks + the existing Button still work**

Run: `pnpm --filter host build`
Expected: succeeds. `apps/host/public/button.chunk.js` still exists (unchanged expose). `apps/host/public/cart-widget.chunk.js` now exists. `cat apps/host/public/share-manifest.json` shows both `./Button` and `./CartWidget` under `exposes`.

- [ ] **Step 8: Verify code-splitting produced a separate handler chunk**

Run: `ls apps/host/public`
Expected: alongside `button.chunk.js`, `cart-widget.chunk.js`, and `share-manifest.json`, at least one additional file matching `start-checkout*.chunk.js`. If missing, add `splitting: true` to the `defineConfig({...})` object in `apps/host/tsup.config.ts` and rerun `pnpm --filter host build:chunks`.

- [ ] **Step 9: Verify no unaliased `react/jsx-runtime` leaked into the bundled chunk**

Run: `grep -c "jsx-runtime" apps/host/public/cart-widget.chunk.js`
Expected: `0`. If nonzero, check that `cart-widget.tsx` only imports `useLazyHandler` (not `Interactive`/`withLazyHandlers`) from `@bridge/lazy-handler`.

- [ ] **Step 10: Run the existing `/demo/share` page's expectations still hold**

Run: `pnpm --filter @bridge/share test`
Expected: PASS — no package test depends on `apps/host`'s manifest contents, so this should be unaffected, but running it here confirms nothing in `packages/share` regressed while `apps/host` changed.

- [ ] **Step 11: Type-check**

Run: `pnpm --filter host type-check`
Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add apps/host/package.json apps/host/next.config.ts apps/host/tsup.config.ts apps/host/src/components/checkout-team pnpm-lock.yaml
git commit -m "feat(host): add CartWidget expose with cross-widget cart sync"
```

---

## Task 6: Shell composition in `apps/web`

**Files:**
- Create: `apps/web/app/demo/ecommerce/page.tsx`, `apps/web/app/demo/ecommerce/components/header.tsx`, `apps/web/app/demo/ecommerce/components/footer.tsx`, `apps/web/app/demo/ecommerce/components/static-cart-icon.tsx`, `apps/web/app/demo/ecommerce/components/panel-skeleton.tsx`
- Modify: `apps/web/app/page.tsx`

**Interfaces:**
- Consumes: `RemoteComponent` from `@bridge/share`; `HydrationBoundary` from `@bridge/hydration`; `./CartWidget` from `apps/host`'s manifest (Task 5); `./HomeWidget`/`./PopularProductsPanel` from `apps/storefront`'s manifest (Tasks 3–4).

- [ ] **Step 1: Create the hydration/error fallback for `CartWidget`**

```tsx
// apps/web/app/demo/ecommerce/components/static-cart-icon.tsx
export function StaticCartIcon() {
  return (
    <button
      disabled
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.5rem 0.75rem',
        background: '#fff',
        border: '1px solid #cbd5e1',
        borderRadius: 8,
      }}
    >
      🛒
    </button>
  );
}
```

- [ ] **Step 2: Create the skeleton fallback for `PopularProductsPanel`**

```tsx
// apps/web/app/demo/ecommerce/components/panel-skeleton.tsx
export function PanelSkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
        padding: '1rem',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        background: '#f8fafc',
      }}
    >
      <div style={{ height: 20, width: '60%', background: '#e2e8f0', borderRadius: 4 }} />
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ height: 64, background: '#e2e8f0', borderRadius: 6 }} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create the Shell-owned `Header`**

```tsx
// apps/web/app/demo/ecommerce/components/header.tsx
'use client';
import { HydrationBoundary } from '@bridge/hydration';
import { RemoteComponent } from '@bridge/share';
import { StaticCartIcon } from './static-cart-icon';

const HOST_MANIFEST = 'http://localhost:3001/share-manifest.json';

export function Header() {
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
        <span>Categories</span>
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

- [ ] **Step 4: Create the Shell-owned `Footer`**

```tsx
// apps/web/app/demo/ecommerce/components/footer.tsx
export function Footer() {
  return (
    <footer
      style={{
        padding: '1.5rem',
        marginTop: '2rem',
        borderTop: '1px solid #e2e8f0',
        fontSize: '0.85rem',
        color: '#64748b',
        textAlign: 'center',
      }}
    >
      Shell-owned footer — no bridges here, just static chrome.
    </footer>
  );
}
```

- [ ] **Step 5: Create the page composing everything**

```tsx
// apps/web/app/demo/ecommerce/page.tsx
'use client';
import { HydrationBoundary } from '@bridge/hydration';
import { RemoteComponent } from '@bridge/share';
import { Header } from './components/header';
import { Footer } from './components/footer';
import { PanelSkeleton } from './components/panel-skeleton';

const STOREFRONT_MANIFEST = 'http://localhost:3002/share-manifest.json';

export default function EcommerceDemoPage() {
  return (
    <>
      <Header />
      <main style={{ display: 'flex', gap: '1.5rem', padding: '1.5rem', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <RemoteComponent
            manifestUrl={STOREFRONT_MANIFEST}
            expose="./HomeWidget"
            fallback={<p>Loading home widget…</p>}
            errorFallback={<p>Home widget unavailable.</p>}
          />
        </div>
        <aside style={{ width: 260 }}>
          <HydrationBoundary strategy="visible" fallback={<PanelSkeleton />}>
            <RemoteComponent
              manifestUrl={STOREFRONT_MANIFEST}
              expose="./PopularProductsPanel"
              fallback={<PanelSkeleton />}
              errorFallback={<p>Recommendations unavailable.</p>}
            />
          </HydrationBoundary>
        </aside>
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 6: Add the nav link on the home page**

```tsx
// apps/web/app/page.tsx — add a new <li> inside the existing <ul>, after the /demo/share entry
<li>
  <Link href="/demo/ecommerce">
    e-commerce example — all three bridges together
  </Link>
</li>
```

- [ ] **Step 7: Type-check**

Run: `pnpm --filter web type-check`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/demo/ecommerce apps/web/app/page.tsx
git commit -m "feat(web): compose e-commerce shell page wiring all three bridges"
```

---

## Task 7: Document the example in `README.md`

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the Monorepo Structure section**

```markdown
<!-- README.md — change this: -->
apps/
  web/          Next.js 15 demo app (all three packages exercised)
  host/         Second Next.js app (serves shared components for @bridge/share)
packages/
  lazy-handler/ @bridge/lazy-handler source
  hydration/    @bridge/hydration source
  share/        @bridge/share source
docs/           Spec and implementation plan

<!-- to this: -->
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

- [ ] **Step 2: Add a short pointer to the new example, right after the Packages table**

```markdown
<!-- README.md — insert after the "Packages" table/section, before "## `@bridge/lazy-handler`" -->
> **See all three working together:** `apps/web`'s `/demo/ecommerce` page composes a small multi-team storefront — a Shell-owned header/footer, a Checkout team's cart widget, and a Home/Recommendations team's product widgets — using `@bridge/share` to load them, `@bridge/hydration` to defer their mount, and `@bridge/lazy-handler` to defer their interaction JS. Run `pnpm dev` from the repo root and open `http://localhost:3000/demo/ecommerce`.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document the e-commerce example in the README"
```

---

## Task 8: End-to-end manual verification

**Files:** none (manual verification only, no code changes)

- [ ] **Step 1: Start all three apps**

Run: `pnpm dev` (from repo root — starts `web` on 3000, `host` on 3001, `storefront` on 3002 via turbo)

- [ ] **Step 2: Verify the cart icon appears immediately, then becomes interactive**

Open `http://localhost:3000/demo/ecommerce`. Expected: the static cart icon (🛒, disabled) renders immediately in the header. After a brief moment (browser idle callback), it's replaced by the live `CartWidget` (same icon, now with a "0" badge and clickable). No layout shift.

- [ ] **Step 3: Verify the home widget renders immediately (no fallback)**

Expected: the "Summer Essentials" hero and its 4-product grid render on initial paint, with no visible loading flash (or a very brief one on first load only, before the manifest/chunk cache warms).

- [ ] **Step 4: Verify the side panel defers until scrolled into view**

Open DevTools → Network tab, filter by `popular-products-panel`. Expected: no request for it until you scroll the panel into the viewport; the gray skeleton blocks render until then.

- [ ] **Step 5: Verify cross-widget cart sync**

Click "Add to Cart" on any product card (in either the home widget or the side panel). Expected: on first click, a short delay (handler JS loading) then the button reads "Added ✓" and disables briefly; the header's cart badge count increments by 1; clicking the cart icon shows a dropdown listing the added item and a "Proceed to Checkout ($X.XX)" button. Add a second item (from either widget) and confirm the badge count and dropdown both update to 2 items with the correct total.

- [ ] **Step 6: Verify the lazy checkout handler**

Hover over "Proceed to Checkout" in the open dropdown, then click it. Expected: hovering preloads the handler (no visible delay on click); clicking changes the button to "✓ Checkout started" and disables it.

- [ ] **Step 7: Verify no console errors**

Check the browser DevTools console. Expected: no errors, specifically none mentioning `window.__bridgeShared` (which would indicate the shared-dep externalization guard failed for `apps/host` or `apps/storefront`).

- [ ] **Step 8: Verify existing demos still work**

Open `http://localhost:3000/demo/share`, click through its 5 existing test cases. Expected: identical behavior to before this plan (cases 1–3 succeed, cases 4–5 show their expected error fallbacks) — `apps/host`'s `./Button` expose is unaffected by this plan's changes.

---

## Post-plan follow-ups (not part of this plan, noted for later)

- No automated Playwright coverage was added for `/demo/ecommerce` — could follow the existing `test:e2e` setup if desired.
- The cart's contents are not persisted (page reload clears it) — this is a front-end composition example only, per the spec's stated non-goals.
