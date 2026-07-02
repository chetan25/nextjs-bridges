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
  if (!initialized.current) {
    window.__bridgeShared = {
      react: React,
      'react-dom': ReactDOM,
      'react-dom/client': ReactDOMClient,
    };
    initialized.current = true;
  }
  return <>{children}</>;
}
