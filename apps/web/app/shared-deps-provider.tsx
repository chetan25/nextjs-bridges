'use client';
import type { ReactNode } from 'react';
import { BridgeSharedDepsProvider } from '@chetand/share';
import * as DateFns from 'date-fns';

// Importing date-fns here (inside a 'use client' module) rather than in
// layout.tsx keeps the module — which contains functions — from ever crossing
// the Server → Client Component prop boundary. RSC can't serialize functions
// passed as props from a Server Component, which is exactly why
// BridgeSharedDepsProvider itself imports React/ReactDOM internally instead
// of receiving them as props.
export function AppSharedDepsProvider({ children }: { children: ReactNode }) {
  return (
    <BridgeSharedDepsProvider
      shared={{
        'date-fns': {
          module: DateFns,
          // Literal process.env.X access (not computed) — Next's bundler
          // only statically inlines literal reads, same constraint as
          // BridgeSharedDepsProvider's own React/React-DOM version reads.
          // date-fns doesn't expose its own version at runtime (unlike
          // React.version), so there's no live value to fall back to — this
          // fallback just mirrors package.json's declared version.
          version: process.env.NEXT_PUBLIC_BRIDGE_VERSION_DATE_FNS ?? '3.6.0',
        },
      }}
    >
      {children}
    </BridgeSharedDepsProvider>
  );
}
