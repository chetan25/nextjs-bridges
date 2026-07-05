# @chetand/lazy-handler

> Defer React event handler JS until first user interaction — Qwik-style O(1) hydration cost.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)

Part of the [`bridges`](https://github.com/chetan25/nextjs-bridges) monorepo — see the [root README](https://github.com/chetan25/nextjs-bridges#readme) for how this fits alongside `@chetand/hydration` and `@chetand/share`, and `apps/web`'s `/demo/ecommerce` page for all three working together.

```bash
pnpm add @chetand/lazy-handler
```

## The problem

Every `onClick` handler — no matter how rarely used — is bundled into the initial payload and hydrated eagerly. A "Notify me" button's entire handler tree loads even if 95% of users never click it.

## How it works

Instead of attaching an event listener at mount time, the library attaches a tiny **stub** listener that:

1. Intercepts the first event
2. Dynamically imports the real handler via `import()`
3. Re-dispatches the original event once the handler resolves
4. Caches the module — all subsequent events call the real handler directly with zero overhead

The result: your handler JS is not downloaded until a user actually triggers the event.

## API

### `useLazyHandler(loader, options?)`

The core hook. Returns a `[ref, stub]` tuple.

```tsx
'use client';
import { useLazyHandler } from '@chetand/lazy-handler';

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

### `<Interactive>`

A declarative wrapper that removes the need to manage refs manually. Renders as a `<span>` by default; use the `as` prop to change the element type.

```tsx
import { Interactive } from '@chetand/lazy-handler';

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

### `withLazyHandlers(Component, handlers)`

Higher-order component. Wraps an existing component without changing its JSX at the call site.

```tsx
import { withLazyHandlers } from '@chetand/lazy-handler';
import { Button } from './Button';

const LazyButton = withLazyHandlers(Button, {
  click: () => import('./handlers/submit'),
});

// Use exactly like <Button>
<LazyButton>Submit</LazyButton>;
```

## Gotchas

- `currentTarget` **is captured synchronously.** The browser nulls out `event.currentTarget` after the dispatch cycle. The stub captures it before the `import()` call and replays it on the async event via a `Proxy`, so your handler receives a correct `currentTarget` even though it runs after `await`.
- **Double-load guard is built in.** Rapid clicks while the module is in flight are deduplicated — the loader is called exactly once.
- **Each loader ref is stable.** You can pass an inline arrow function as `loader`; the hook holds a ref to the latest version without causing effect re-runs.
- **No SSR output.** The stub is never attached on the server. The element renders as static HTML until the client hydrates — which is the point.
- `preloadOn: 'visible'` **requires** `IntersectionObserver`**.** Falls back to no preload in environments that lack it (e.g. Node/jsdom test environments).
- `preloadOn: 'idle'` **needs no DOM event.** It schedules via `requestIdleCallback` (falling back to `setTimeout(fn, 0)` where unavailable) as soon as the element mounts. Pass an array (e.g. `preloadOn: ['hover', 'idle']`) to arm multiple strategies at once — the first one to fire loads the module; the rest become no-ops.

## Known limitation

No loading-state API — there's no built-in way to show a spinner while the handler is in flight. Manage that state in the parent component if you need it.

## License

[MIT](../../LICENSE)
