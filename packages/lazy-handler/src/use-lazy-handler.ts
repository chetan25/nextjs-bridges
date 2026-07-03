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
