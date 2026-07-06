'use client';
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  Suspense,
  lazy,
  createElement,
  type LazyExoticComponent,
  type ComponentType,
} from 'react';
import { HydrationContext } from './hydration-context';
import type { HydrationBoundaryProps } from './types';

export function HydrationBoundary<P extends object = object>({
  strategy = 'visible',
  children,
  loader,
  componentProps,
  fallback = null,
  threshold = 0.1,
  rootMargin = '200px',
  onHydrate,
}: HydrationBoundaryProps<P>) {
  const [hydrated, setHydrated] = useState(strategy === 'eager');
  const ref = useRef<HTMLDivElement>(null);
  const onHydrateRef = useRef(onHydrate);
  onHydrateRef.current = onHydrate;

  // loaderRef holds the latest loader identity so a fresh inline arrow function
  // passed on every render doesn't recreate (and thus re-invoke) the lazy wrapper.
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const lazyComponentRef = useRef<LazyExoticComponent<ComponentType<P>> | null>(null);
  if (loader && !lazyComponentRef.current) {
    lazyComponentRef.current = lazy(() => loaderRef.current!());
  }

  const hydrateNow = useCallback(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      onHydrateRef.current?.();
      return;
    }
  }, [hydrated]);

  useEffect(() => {
    if (hydrated || strategy === 'eager') return;

    if (strategy === 'visible') {
      if (typeof IntersectionObserver === 'undefined') {
        // Fallback for environments without IntersectionObserver (SSR-adjacent)
        setHydrated(true);
        return;
      }
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setHydrated(true);
            obs.disconnect();
          }
        },
        { threshold, rootMargin },
      );
      if (ref.current) obs.observe(ref.current);
      return () => obs.disconnect();
    }

    if (strategy === 'idle') {
      let id: ReturnType<typeof setTimeout>;
      if ('requestIdleCallback' in window) {
        id = requestIdleCallback(() => setHydrated(true)) as unknown as ReturnType<typeof setTimeout>;
        return () => cancelIdleCallback(id as unknown as number);
      } else {
        id = setTimeout(() => setHydrated(true), 0);
        return () => clearTimeout(id);
      }
    }

    if (strategy === 'interaction') {
      const el = ref.current;
      if (!el) return;
      const trigger = () => setHydrated(true);
      const events = ['pointerenter', 'focusin', 'touchstart'] as const;
      events.forEach((ev) => el.addEventListener(ev, trigger, { once: true }));
      return () => events.forEach((ev) => el.removeEventListener(ev, trigger));
    }

    // 'manual' — hydration triggered by hydrateNow() via context
  }, [strategy, hydrated, threshold, rootMargin]);

  const LazyComponent = lazyComponentRef.current;
  // TS can't prove a bare generic P satisfies its own props-attribute constraints;
  // the public API (HydrationBoundaryProps<P>) already guarantees componentProps: P
  // matches loader's ComponentType<P>, so this cast is safe by construction.
  const content = LazyComponent
    ? createElement(
        LazyComponent as unknown as ComponentType<Record<string, unknown>>,
        componentProps as Record<string, unknown>,
      )
    : children;

  return (
    <HydrationContext.Provider value={{ hydrated, hydrateNow }}>
      <div ref={ref}>
        {hydrated ? <Suspense fallback={fallback}>{content}</Suspense> : <>{fallback}</>}
      </div>
    </HydrationContext.Provider>
  );
}
