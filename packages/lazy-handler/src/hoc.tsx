'use client';
import { useRef, useCallback, type ComponentType } from 'react';
import type { Loader } from './types';

type HandlerMap = Record<string, Loader>;

// withLazyHandlers wires lazy loading via React props (not native addEventListener),
// so it works with any component — no forwardRef required.
export function withLazyHandlers<P extends object>(
  Component: ComponentType<P>,
  handlerMap: HandlerMap,
): ComponentType<P> {
  const firstEvent = Object.keys(handlerMap)[0] ?? 'click';
  const firstLoader = handlerMap[firstEvent];
  // Map event name 'click' → React prop name 'onClick'
  const propName = `on${firstEvent.charAt(0).toUpperCase()}${firstEvent.slice(1)}`;

  function LazyWrapped(props: P) {
    // handlerRef holds the resolved handler after first load
    const handlerRef = useRef<((...args: unknown[]) => unknown) | null>(null);
    const loadingRef = useRef(false);
    // Keep loader ref current without re-creating the stub on loader identity changes
    const loaderRef = useRef(firstLoader);
    loaderRef.current = firstLoader;

    const stub = useCallback((...args: unknown[]) => {
      if (handlerRef.current) {
        return handlerRef.current(...args);
      }
      if (loadingRef.current) return;
      loadingRef.current = true;
      loaderRef.current()
        .then((mod) => {
          handlerRef.current = mod.default as (...a: unknown[]) => unknown;
          loadingRef.current = false;
          return handlerRef.current(...args);
        })
        .catch(() => {
          loadingRef.current = false;
        });
    }, []);

    const handlerProps = { [propName]: stub } as Partial<P>;
    return <Component {...props} {...handlerProps} />;
  }

  LazyWrapped.displayName = `withLazyHandlers(${Component.displayName ?? Component.name})`;
  return LazyWrapped;
}
