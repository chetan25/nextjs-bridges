'use client';
import { useRef, type ReactNode } from 'react';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';

declare global {
  interface Window {
    __bridgeShared?: Record<string, unknown>;
  }
}

// Next.js's Turbopack dev server resolves 'react'/'react-dom' for every
// 'use client' component to its own internally-vendored canary build,
// regardless of what's actually installed, so a live React.version/
// ReactDOM.version read here can report Next's tooling version rather than
// the shell's real declared dependency. sharedDepsConfig() (next-config-
// helper.ts) injects the real version as a build-time env var from the same
// package.json read that produces shared-contract.json; prefer that,
// falling back to the live value only when it wasn't configured (e.g.
// tests, or apps not using sharedDepsConfig()).
//
// These MUST be literal `process.env.NEXT_PUBLIC_...` member accesses, not a
// computed/bracket lookup built from a helper function — Next's bundler
// (webpack and Turbopack alike) only statically inlines literal
// `process.env.X` reads at build time. A dynamic key is never replaced and
// silently reads an unpopulated value in the browser, always falling
// through to the (possibly-wrong) live version. Confirmed by direct
// inspection of the compiled Turbopack dev bundle. The literal names here
// must match next-config-helper.ts's `sharedDepEnvKey('react')` /
// `sharedDepEnvKey('react-dom')` output exactly.
function resolvedReactVersion(): string {
  return process.env.NEXT_PUBLIC_BRIDGE_VERSION_REACT ?? React.version;
}

function resolvedReactDomVersion(): string {
  return process.env.NEXT_PUBLIC_BRIDGE_VERSION_REACT_DOM ?? ReactDOM.version;
}

/**
 * Publishes the shell's own React/React-DOM instances on window.__bridgeShared
 * so externalized remote chunks (see shims/*.ts) can reference the exact same
 * module instance instead of bundling their own copy. Must be mounted above
 * every usage of <RemoteComponent>/useRemoteComponent in the tree — React
 * commits a parent's render before any descendant's effects run, so this
 * assignment is guaranteed to happen before useRemoteComponent's effect fires.
 */
export function BridgeSharedDepsProvider({ children }: { children: ReactNode }) {
  const initialized = useRef(false);
  if (!initialized.current && typeof window !== 'undefined') {
    const reactDomVersion = resolvedReactDomVersion();
    window.__bridgeShared = {
      react: { ...React, version: resolvedReactVersion() },
      'react-dom': { ...ReactDOM, version: reactDomVersion },
      'react-dom/client': { ...ReactDOMClient, version: reactDomVersion },
    };
    initialized.current = true;
  }
  return <>{children}</>;
}
