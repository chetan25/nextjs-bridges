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
import { HydrationErrorBoundary } from './hydration-error-boundary';
import type { HydrationBoundaryProps } from './types';

const DEFAULT_INTERACTION_EVENTS: Array<keyof HTMLElementEventMap> = [
  'pointerenter',
  'focusin',
  'touchstart',
];

export function HydrationBoundary<P extends object = object>({
  strategy = 'visible',
  children,
  loader,
  componentProps,
  fallback = null,
  threshold = 0.1,
  rootMargin = '200px',
  interactionEvents,
  onHydrate,
  errorFallback,
}: HydrationBoundaryProps<P>) {
  const strategies = Array.isArray(strategy) ? strategy : [strategy];
  // Stable string key for the effect's dependency array — `strategies` is a fresh
  // array reference every render when `strategy` is passed as an inline literal,
  // so depending on it directly would tear down and re-arm listeners every render.
  const strategiesKey = strategies.join(',');
  const events = interactionEvents ?? DEFAULT_INTERACTION_EVENTS;
  const interactionEventsKey = events.join(',');

  const [hydrated, setHydrated] = useState(() => strategies.includes('eager'));
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
    if (hydrated) return;

    const trigger = () => setHydrated(true);
    const teardowns: Array<() => void> = [];

    // strategiesKey (the effect dependency) is derived from `strategies` via
    // .join(','), so it's safe to read the freshly-computed `strategies` array
    // here — it always matches the key that triggered this run.
    for (const s of strategies) {
      // 'eager' is handled by the initial state; 'manual' has no listener —
      // hydration only happens via hydrateNow() through the context.
      if (s === 'eager' || s === 'manual') continue;

      if (s === 'visible') {
        if (typeof IntersectionObserver === 'undefined') {
          // Fallback for environments without IntersectionObserver (SSR-adjacent)
          trigger();
          continue;
        }
        const obs = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              trigger();
              obs.disconnect();
            }
          },
          { threshold, rootMargin },
        );
        if (ref.current) obs.observe(ref.current);
        teardowns.push(() => obs.disconnect());
        continue;
      }

      if (s === 'idle') {
        let id: ReturnType<typeof setTimeout>;
        if ('requestIdleCallback' in window) {
          id = requestIdleCallback(trigger) as unknown as ReturnType<typeof setTimeout>;
          teardowns.push(() => cancelIdleCallback(id as unknown as number));
        } else {
          id = setTimeout(trigger, 0);
          teardowns.push(() => clearTimeout(id));
        }
        continue;
      }

      if (s === 'interaction') {
        const el = ref.current;
        if (!el) continue;
        // interactionEventsKey (the effect dependency) is derived from `events`
        // via .join(','), so it's safe to read the freshly-computed `events`
        // array here — it always matches the key that triggered this run.
        events.forEach((ev) => el.addEventListener(ev, trigger, { once: true }));
        teardowns.push(() => events.forEach((ev) => el.removeEventListener(ev, trigger)));
      }
    }

    return () => teardowns.forEach((fn) => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategiesKey, hydrated, threshold, rootMargin, interactionEventsKey]);

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

  const suspended = <Suspense fallback={fallback}>{content}</Suspense>;

  return (
    <HydrationContext.Provider value={{ hydrated, hydrateNow }}>
      <div ref={ref}>
        {hydrated
          ? errorFallback !== undefined
            ? <HydrationErrorBoundary fallback={errorFallback}>{suspended}</HydrationErrorBoundary>
            : suspended
          : <>{fallback}</>}
      </div>
    </HydrationContext.Provider>
  );
}
