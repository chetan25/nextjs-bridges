import type { ReactNode } from 'react';

export type HydrationStrategy = 'eager' | 'visible' | 'idle' | 'interaction' | 'manual';

export interface HydrationBoundaryProps {
  strategy?: HydrationStrategy;
  children: ReactNode;
  fallback?: ReactNode;
  /** IntersectionObserver threshold — number or array. Only used with strategy='visible'. */
  threshold?: number | number[];
  /** IntersectionObserver rootMargin. Only used with strategy='visible'. */
  rootMargin?: string;
  /** Fired once when the boundary hydrates. */
  onHydrate?: () => void;
}

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
