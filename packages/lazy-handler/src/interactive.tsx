'use client';
import { type ElementType, type ReactNode } from 'react';
import { useLazyHandler } from './use-lazy-handler';
import type { Loader, LazyHandlerOptions } from './types';

// Single-event map: exactly one entry is supported per <Interactive>.
// Use multiple <Interactive> wrappers or useLazyHandler directly for multiple events.
type SingleEventLoader = {
  [K in keyof HTMLElementEventMap]?: Loader;
};

type ErrorFallbackProp = ReactNode | ((error: Error) => ReactNode);

interface InteractiveProps<E extends ElementType = 'span'> {
  as?: E;
  on: SingleEventLoader;
  children: ReactNode;
  preloadOn?: LazyHandlerOptions['preloadOn'];
  /** Skip `preloadOn` on Save-Data or a slow connection. Default `true`. See `useLazyHandler`. */
  respectConnection?: LazyHandlerOptions['respectConnection'];
  /** Rendered in place of children while the handler module is being fetched. */
  loadingFallback?: ReactNode;
  /** Rendered in place of children if the handler module fails to load. */
  errorFallback?: ErrorFallbackProp;
  /** Called when the handler module fails to load — cold load or preload alike. */
  onError?: (error: Error) => void;
}

// Polymorphic <Interactive> — defaults to <span> to avoid breaking inline/table contexts.
export function Interactive<E extends ElementType = 'span'>({
  as,
  on,
  children,
  preloadOn = 'none',
  respectConnection,
  loadingFallback,
  errorFallback,
  onError,
}: InteractiveProps<E>) {
  const Tag = (as ?? 'span') as ElementType;

  const keys = Object.keys(on);
  if (process.env.NODE_ENV !== 'production' && keys.length > 1) {
    console.error(
      `[Interactive] "on" received ${keys.length} events (${keys.join(', ')}). ` +
        'Only the first event is wired; use multiple <Interactive> wrappers for multiple events.',
    );
  }

  const primaryEvent = keys[0] as keyof HTMLElementEventMap | undefined;
  const primaryLoader = primaryEvent ? on[primaryEvent] : undefined;

  const [ref, , isLoading, error] = useLazyHandler(
    primaryLoader ?? (() => Promise.resolve({ default: () => {} })),
    {
      event: primaryEvent ?? 'click',
      preloadOn,
      ...(onError ? { onError } : {}),
      ...(respectConnection !== undefined ? { respectConnection } : {}),
    },
  );

  let content = children;
  if (isLoading && loadingFallback !== undefined) {
    content = loadingFallback;
  } else if (error && errorFallback !== undefined) {
    content = typeof errorFallback === 'function' ? errorFallback(error) : errorFallback;
  }

  // Tag (and its ref/listener) never changes — only the rendered content swaps.
  return <Tag ref={ref}>{content}</Tag>;
}
