'use client';
import { useRef, useCallback, useEffect, useState } from 'react';
import type { HandlerFn, Loader, LazyHandlerOptions } from './types';

export function useLazyHandler<T extends Element>(
  loader: Loader,
  options: LazyHandlerOptions = {},
): [(node: T | null) => void, (e: Event) => void] {
  const { event = 'click', capture = false, preloadOn = 'none' } = options;

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

    if (preloadOn === 'visible') {
      if (typeof IntersectionObserver !== 'undefined') {
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
        return () => {
          cancelledRef.current = true;
          el.removeEventListener(event, stub, { capture });
          obs.disconnect();
        };
      }
    } else if (preloadOn !== 'none') {
      // Map friendly preloadOn names to real DOM event names.
      // 'hover' is not a DOM event; browsers fire 'mouseenter'/'mouseover'.
      // 'focus' maps to 'focusin' so it also works on delegated containers.
      const DOM_PRELOAD_EVENTS: Record<string, string> = {
        hover: 'mouseenter',
        focus: 'focusin',
      };
      const preloadEvent = DOM_PRELOAD_EVENTS[preloadOn] ?? preloadOn;
      el.addEventListener(preloadEvent, doPreload, { once: true });
      return () => {
        cancelledRef.current = true;
        el.removeEventListener(event, stub, { capture });
        el.removeEventListener(preloadEvent, doPreload);
      };
    }

    return () => {
      cancelledRef.current = true;
      el.removeEventListener(event, stub, { capture });
    };
  }, [node, event, capture, preloadOn, stub]);

  return [ref, stub];
}
