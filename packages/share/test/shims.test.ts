import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as RealReact from 'react';
import * as RealReactDOM from 'react-dom';
import * as RealReactDOMClient from 'react-dom/client';

declare global {
  interface Window {
    __bridgeShared?: Record<string, unknown>;
  }
}

describe('shims', () => {
  beforeEach(() => {
    vi.resetModules();
    window.__bridgeShared = {
      react: RealReact,
      'react-dom': RealReactDOM,
      'react-dom/client': RealReactDOMClient,
    };
  });

  it('react-shim default-exports the shared React instance', async () => {
    const shim = await import('../src/shims/react-shim');
    expect(shim.default).toBe(RealReact);
  });

  it('react-shim re-exports useState/useEffect/createElement (spot check)', async () => {
    const shim = await import('../src/shims/react-shim');
    expect(shim.useState).toBe(RealReact.useState);
    expect(shim.useEffect).toBe(RealReact.useEffect);
    expect(shim.createElement).toBe(RealReact.createElement);
  });

  it('react-shim throws a descriptive error when window.__bridgeShared.react is missing', async () => {
    window.__bridgeShared = {};
    await expect(import('../src/shims/react-shim')).rejects.toThrow('window.__bridgeShared.react');
  });

  it('react-dom-shim re-exports createPortal/flushSync/version', async () => {
    const shim = await import('../src/shims/react-dom-shim');
    expect(shim.createPortal).toBe(RealReactDOM.createPortal);
    expect(shim.flushSync).toBe(RealReactDOM.flushSync);
    expect(shim.version).toBe(RealReactDOM.version);
  });

  it('react-dom-client-shim re-exports createRoot/hydrateRoot', async () => {
    const shim = await import('../src/shims/react-dom-client-shim');
    expect(shim.createRoot).toBe(RealReactDOMClient.createRoot);
    expect(shim.hydrateRoot).toBe(RealReactDOMClient.hydrateRoot);
  });
});
