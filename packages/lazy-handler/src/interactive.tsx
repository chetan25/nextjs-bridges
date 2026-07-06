'use client';
import { type ElementType, type ReactNode } from 'react';
import { useLazyHandler } from './use-lazy-handler';
import type { Loader, LazyHandlerOptions } from './types';

// Single-event map: exactly one entry is supported per <Interactive>.
// Use multiple <Interactive> wrappers or useLazyHandler directly for multiple events.
type SingleEventLoader = {
  [K in keyof HTMLElementEventMap]?: Loader;
};

interface InteractiveProps<E extends ElementType = 'span'> {
  as?: E;
  on: SingleEventLoader;
  children: ReactNode;
  preloadOn?: LazyHandlerOptions['preloadOn'];
  /** Rendered in place of children while the handler module is being fetched. */
  loadingFallback?: ReactNode;
}

// Polymorphic <Interactive> — defaults to <span> to avoid breaking inline/table contexts.
export function Interactive<E extends ElementType = 'span'>({
  as,
  on,
  children,
  preloadOn = 'none',
  loadingFallback,
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

  const [ref, , isLoading] = useLazyHandler(
    primaryLoader ?? (() => Promise.resolve({ default: () => {} })),
    { event: primaryEvent ?? 'click', preloadOn },
  );

  // Tag (and its ref/listener) never changes — only the rendered content swaps.
  return (
    <Tag ref={ref}>{isLoading && loadingFallback !== undefined ? loadingFallback : children}</Tag>
  );
}
