'use client';
import { useContext } from 'react';
import { HydrationContext } from './hydration-context';
import type { HydrationState } from './types';

export function useHydrationState(): HydrationState {
  const ctx = useContext(HydrationContext);
  if (!ctx) {
    return { hydrated: true, hydrateNow: () => {} };
  }
  return ctx;
}
