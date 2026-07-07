'use client';
import { useLazyHandler } from './use-lazy-handler';
import type { FormLoader, Loader, PreloadStrategy } from './types';

export interface UseLazyFormOptions {
  preloadOn?: PreloadStrategy | PreloadStrategy[];
}

/**
 * `useLazyHandler` specialized for the extremely common "defer the submit
 * handler" case. A bare `useLazyHandler(loader, { event: 'submit' })` is
 * unsafe: the browser's native submit (page navigation / form reset) fires
 * synchronously right after dispatch, before an async `import()` can resolve,
 * so the page would navigate away before your handler ever runs.
 * `useLazyForm` always calls `preventDefault()` on interception — cold or
 * warm — so your handler module never races the native submit.
 *
 * Returns a `[ref, isLoading]` tuple — attach `ref` to the `<form>` element.
 */
export function useLazyForm<T extends HTMLFormElement = HTMLFormElement>(
  loader: FormLoader,
  options: UseLazyFormOptions = {},
): [(node: T | null) => void, boolean] {
  // FormLoader's handler is typed against SubmitEvent (a subtype of the plain
  // Event that useLazyHandler's Loader expects) — safe to widen here because
  // a 'submit' listener is only ever invoked with a SubmitEvent.
  const [ref, , isLoading] = useLazyHandler<T>(loader as unknown as Loader, {
    event: 'submit',
    preventDefault: true,
    preloadOn: options.preloadOn ?? 'none',
  });

  return [ref, isLoading];
}
