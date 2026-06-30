import { type ComponentType } from 'react';
import { HydrationBoundary } from './hydration-boundary';
import type { HydrationOptions } from './types';

export function withHydrationBoundary<P extends object>(
  Component: ComponentType<P>,
  options?: HydrationOptions,
): ComponentType<P> {
  function HydrationWrapped(props: P) {
    return (
      <HydrationBoundary {...options}>
        <Component {...props} />
      </HydrationBoundary>
    );
  }

  HydrationWrapped.displayName = `withHydrationBoundary(${Component.displayName ?? Component.name})`;
  return HydrationWrapped;
}
