# @bridge/hydration

> Declarative hydration boundaries for Next.js 15 — defer Client Component hydration until a chosen strategy fires.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)

Part of the [`bridges`](https://github.com/chetan25/nextjs-bridges) monorepo — see the [root README](https://github.com/chetan25/nextjs-bridges#readme) for how this fits alongside `@bridge/lazy-handler` and `@bridge/share`, and `apps/web`'s `/demo/ecommerce` page for all three working together.

```bash
pnpm add @bridge/hydration
```

## The problem

Once a subtree is marked `'use client'`, React hydrates the whole thing immediately, including heavy widgets far below the fold. There is no declarative way to say "hydrate this when visible" or "hydrate on first hover."

## How it works

`<HydrationBoundary>` wraps any subtree and gates rendering behind a boolean `hydrated` state. Until that state flips, the boundary renders the `fallback` prop (skeleton, spinner, or nothing). Hydration is triggered by a chosen **strategy** — viewport visibility, browser idle time, first pointer contact, or a manual imperative call.

This is purely a React-level deferral. The component JS is still bundled; hydration just determines when React mounts and makes the subtree interactive.

## API

### `<HydrationBoundary>`

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
| `threshold`  | `number \| number[]` | `0.1`      | IntersectionObserver threshold — `visible` strategy only  |
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

### `useHydrationState()`

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

### `withHydrationBoundary(Component, options?)`

HOC version. Wraps a component in a boundary without changing its usage.

```tsx
import { withHydrationBoundary } from '@bridge/hydration';

const LazyChart = withHydrationBoundary(Chart, {
  strategy: 'visible',
  fallback: <ChartSkeleton />,
});
```

## Nesting

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

## Gotchas

- **This is render-time deferral, not code-splitting.** The JS bundle for `<HeavyWidget>` is still sent to the browser — it just isn't executed until the strategy triggers. Combine with `React.lazy` + `next/dynamic` for actual code splitting.
- `strategy="eager"` **is a no-op.** The boundary renders children immediately, same as removing it. Useful for toggling deferral in development without changing JSX.
- **No SSR hydration mismatch.** The boundary renders `fallback` on the server as well, so the initial HTML always matches the dehydrated state.
- `IntersectionObserver` **fallback.** When unavailable (Node, jsdom), `strategy="visible"` falls back to hydrating immediately.
- `onHydrate` **stability.** The callback ref is always kept current without causing effects to re-run; you can pass an inline function safely.

## Known limitations

- **No code-splitting integration.** The boundary defers hydration but the bundle is still sent eagerly. First-class `next/dynamic` + boundary composition is not wired up yet.
- `strategy="interaction"` **triggers on any pointer contact.** There is no way to narrow the trigger to a specific event type (e.g. `click` only) through the declarative API. Use `withHydrationBoundary` with `useHydrationState` to build a custom trigger.

## License

[MIT](../../LICENSE)
