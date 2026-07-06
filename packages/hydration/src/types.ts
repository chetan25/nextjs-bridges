import type { ComponentType, ReactNode } from 'react';

export type HydrationStrategy = 'eager' | 'visible' | 'idle' | 'interaction' | 'manual';

/** Matches React.lazy()'s contract exactly — passed straight through to it. */
export type ComponentLoader<P extends object = object> = () => Promise<{ default: ComponentType<P> }>;

interface HydrationBoundaryBaseProps {
  strategy?: HydrationStrategy;
  fallback?: ReactNode;
  /** IntersectionObserver threshold — number or array. Only used with strategy='visible'. */
  threshold?: number | number[];
  /** IntersectionObserver rootMargin. Only used with strategy='visible'. */
  rootMargin?: string;
  /** Fired once when the boundary hydrates. */
  onHydrate?: () => void;
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
  strategy?: HydrationStrategy;
  threshold?: number | number[];
  rootMargin?: string;
  onHydrate?: () => void;
}
