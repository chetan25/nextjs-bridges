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

The core hook. Returns a `[ref, stub, isLoading, error]` tuple. `error` is `null` unless the loader promise rejected — it clears again as soon as a retry starts loading.

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
| `preventDefault` | `boolean`                                                    | `false`   | Call `event.preventDefault()` synchronously on interception, before the handler module loads. Needed for events with a native default action (e.g. `submit`) — see `useLazyForm` below. |
| `onError`   | `(error: Error) => void`                                          | —         | Called when the loader promise rejects — cold load or preload alike. |
| `respectConnection` | `boolean`                                                | `true`    | Skip `preloadOn` on Save-Data or a slow (`2g`/`slow-2g`) connection. The real trigger event is never skipped — only speculative preloading. No-ops (never skips) in browsers without the Network Information API (Firefox, Safari). |

Your handler module must export a default function:

```ts
// handlers/notify.ts
export default function notify(event: Event) {
  // runs only when the user clicks
}
```

### `useLazyForm(loader, options?)`

`useLazyHandler` specialized for the extremely common "defer the submit handler" case. A bare `useLazyHandler(loader, { event: 'submit' })` is unsafe: the browser's native submit (page navigation) fires synchronously right after dispatch, before an async `import()` can resolve — so the page would navigate away before your handler ever runs. `useLazyForm` always calls `preventDefault()` on interception, cold or warm, so this can't happen. Returns a `[ref, isLoading]` tuple — attach `ref` to the `<form>` element.

```tsx
'use client';
import { useLazyForm } from '@chetand/lazy-handler';

export function SignupForm() {
  const [ref, isLoading] = useLazyForm(
    () => import('./handlers/submit-signup'), // loaded only on first submit
    { preloadOn: 'idle' }, // optional: preload once the browser is idle
  );

  return (
    <form ref={ref}>
      {/* ...fields... */}
      <button type="submit" disabled={isLoading}>{isLoading ? 'Loading…' : 'Sign up'}</button>
    </form>
  );
}
```

```ts
// handlers/submit-signup.ts
export default function submitSignup(event: SubmitEvent) {
  // event.preventDefault() has already been called for you — no need to call it here
  const data = new FormData(event.currentTarget as HTMLFormElement);
  // ...
}
```

`options` accepts the same `preloadOn` and `respectConnection` as `useLazyHandler`; `event` and `preventDefault` are fixed internally and can't be overridden.

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

{
  /* Handle a failed load */
}
<Interactive
  on={{ click: () => import('./handlers/notify') }}
  errorFallback={(error) => <span>Couldn't load: {error.message}</span>}
  onError={(error) => analytics.track('handler-load-failed', { message: error.message })}
>
  <button>Notify me</button>
</Interactive>;
```

`errorFallback` (optional) is rendered in place of `children` if the handler module fails to load; omitting it keeps rendering `children` on failure, same as before this option existed. `onError` (optional) fires on every failed load — cold load or preload alike.

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

The wrapped component always receives `isLoading: boolean` and `error: Error | null` props alongside its handler prop (e.g. `onClick`), reflecting the state of the click-triggered load.

## Performance: `preloadOn` vs. browser resource hints

`preloadOn` is already a form of preloading — it triggers the same `import()` your real event would, just earlier, on a signal (hover, idle, visibility) that suggests the user is likely to need it soon. That's different from a browser resource hint like `<link rel="modulepreload">`: this library can't emit one for your handler, because `loader` is your own bundler-resolved `import('./handlers/notify')` — Turbopack/webpack rewrite that into their own chunk-loading call with a build-time-generated URL the library never sees. (Compare this to `@chetand/share`, which *can* inject `<link rel="modulepreload">` for its chunks, because it resolves those URLs itself from a manifest at runtime, rather than through a bundler-opaque `import()`.)

If you want an actual resource hint in addition to (or instead of) `preloadOn`, add it to your own loader with your bundler's magic comment:

```ts
// handlers/notify.ts's loader, decorated for the bundler:
() => import(/* webpackPrefetch: true */ './handlers/notify')
```

This asks the bundler to emit its own `<link rel="prefetch">` for that chunk wherever the containing module loads — independent of any `preloadOn` strategy. Check your exact Turbopack/Next.js version's support for this comment before relying on it; magic-comment support has historically lagged webpack's in Turbopack.

### Network-aware preloading

`preloadOn` respects the user's connection by default (`respectConnection: true`): on Save-Data or a slow (`2g`/`slow-2g`) connection, speculative preload strategies (hover/focus/idle/visible) are skipped so they don't compete with whatever's actually on the critical path. The real trigger event (the click, the submit) is **never** skipped — only the early, speculative fetch. Set `respectConnection: false` to always preload regardless of connection. This relies on the non-standard Network Information API (`navigator.connection`), which only Chromium-based browsers implement — in Firefox/Safari, `respectConnection` has no effect either way, since there's nothing to check.

## Gotchas

- `currentTarget` **is captured synchronously.** The browser nulls out `event.currentTarget` after the dispatch cycle. The stub captures it before the `import()` call and replays it on the async event via a `Proxy`, so your handler receives a correct `currentTarget` even though it runs after `await`.
- **Double-load guard is built in.** Rapid clicks while the module is in flight are deduplicated — the loader is called exactly once.
- **Each loader ref is stable.** You can pass an inline arrow function as `loader`; the hook holds a ref to the latest version without causing effect re-runs.
- **No SSR output.** The stub is never attached on the server. The element renders as static HTML until the client hydrates — which is the point.
- `preloadOn: 'visible'` **requires** `IntersectionObserver`**.** Falls back to no preload in environments that lack it (e.g. Node/jsdom test environments).
- `preloadOn: 'idle'` **needs no DOM event.** It schedules via `requestIdleCallback` (falling back to `setTimeout(fn, 0)` where unavailable) as soon as the element mounts. Pass an array (e.g. `preloadOn: ['hover', 'idle']`) to arm multiple strategies at once — the first one to fire loads the module; the rest become no-ops.
- **A failed `hover`/`focus` preload isn't retried on its own.** Those listeners are armed with `{ once: true }`; if the preload attempt fails, the listener isn't re-armed. The real trigger event (e.g. `click`) still retries the load normally — only the early-preload optimization is lost for that element.

## Known limitations

`withLazyHandlers` has no `preloadOn` support — only `useLazyHandler` and `<Interactive>` can preload early. Use one of those two if you need a preload strategy.

## License

[MIT](../../LICENSE)
