'use client';
import { type ComponentType } from 'react';
import { useLazyHandler } from './use-lazy-handler';
import type { Loader, LazyHandlerOptions } from './types';

type HandlerMap = Record<string, Loader>;

// Wraps an existing component, replacing the named event props with lazy stubs.
// The wrapped component receives the same props — callers don't need to change anything.
export function withLazyHandlers<P extends object>(
  Component: ComponentType<P>,
  handlerMap: HandlerMap,
  options?: Omit<LazyHandlerOptions, 'event'>,
): ComponentType<P> {
  const firstEvent = Object.keys(handlerMap)[0] ?? 'click';
  const firstLoader = handlerMap[firstEvent];

  function LazyWrapped(props: P) {
    const [ref, stub] = useLazyHandler(
      firstLoader ?? (() => Promise.resolve({ default: () => {} })),
      { event: firstEvent as keyof HTMLElementEventMap, ...options },
    );

    // Only replace the primary event's prop — leave all other props untouched.
    // Setting non-primary props to undefined would override the wrapped component's
    // own handlers, silently disabling them.
    const propName = `on${firstEvent.charAt(0).toUpperCase()}${firstEvent.slice(1)}`;
    const handlerProps: Record<string, unknown> = { [propName]: stub };

    return <Component ref={ref as never} {...props} {...handlerProps} />;
  }

  LazyWrapped.displayName = `withLazyHandlers(${Component.displayName ?? Component.name})`;
  return LazyWrapped;
}
