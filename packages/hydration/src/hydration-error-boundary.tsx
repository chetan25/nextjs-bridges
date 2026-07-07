'use client';
import { Component, type ReactNode } from 'react';
import type { HydrationErrorFallback } from './types';

interface Props {
  children: ReactNode;
  fallback: HydrationErrorFallback;
}

interface State {
  caught: Error | null;
}

export class HydrationErrorBoundary extends Component<Props, State> {
  state: State = { caught: null };

  static getDerivedStateFromError(error: unknown): State {
    return { caught: error instanceof Error ? error : new Error(String(error)) };
  }

  render() {
    if (this.state.caught) {
      const { fallback } = this.props;
      return typeof fallback === 'function' ? fallback(this.state.caught) : fallback;
    }
    return this.props.children;
  }
}
