import type { ComponentType, ReactNode } from 'react';

export type HydrationStrategy = 'eager' | 'visible' | 'idle' | 'interaction' | 'manual';

/** Matches React.lazy()'s contract exactly — passed straight through to it. */
export type ComponentLoader<P extends object = object> = () => Promise<{ default: ComponentType<P> }>;

export type HydrationErrorFallback = ReactNode | ((error: Error) => ReactNode);

interface HydrationBoundaryBaseProps {
  /** A single strategy, or an array — whichever strategy in the array fires first hydrates the boundary. */
  strategy?: HydrationStrategy | HydrationStrategy[];
  fallback?: ReactNode;
  /** IntersectionObserver threshold — number or array. Only used with strategy='visible'. */
  threshold?: number | number[];
  /** IntersectionObserver rootMargin. Only used with strategy='visible'. */
  rootMargin?: string;
  /**
   * DOM events that trigger hydration. Only used with strategy='interaction'.
   * Defaults to `['pointerenter', 'focusin', 'touchstart']` — pass a narrower
   * list (e.g. `['click']`) to require a specific interaction instead of any
   * pointer contact.
   */
  interactionEvents?: Array<keyof HTMLElementEventMap>;
  /** Fired once when the boundary hydrates. */
  onHydrate?: () => void;
  /**
   * Rendered instead of crashing the tree if `loader` rejects. Wraps the
   * boundary's content in an internal error boundary — without this prop, a
   * rejected `loader` throws during render same as any `React.lazy` component,
   * and you're responsible for supplying your own error boundary.
   */
  errorFallback?: HydrationErrorFallback;
}

// children and loader are mutually exclusive: either you already have the component
// (eager import, no code-splitting) or you want it dynamically imported once hydrated.
export type HydrationBoundaryProps<P extends object = object> = HydrationBoundaryBaseProps &
  (
    | { children: ReactNode; loader?: never; componentProps?: never }
    | { children?: never; loader: ComponentLoader<P>; componentProps?: P }
  );

export interface HydrationState {
  hydrated: boolean;
  hydrateNow: () => void;
}

export interface HydrationOptions {
  strategy?: HydrationStrategy | HydrationStrategy[];
  threshold?: number | number[];
  rootMargin?: string;
  interactionEvents?: Array<keyof HTMLElementEventMap>;
  onHydrate?: () => void;
  errorFallback?: HydrationErrorFallback;
}
