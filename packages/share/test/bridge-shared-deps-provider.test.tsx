import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import { BridgeSharedDepsProvider } from '../src/bridge-shared-deps-provider';

declare global {
  interface Window {
    __bridgeShared?: Record<string, unknown>;
  }
}

describe('<BridgeSharedDepsProvider>', () => {
  it('renders its children', () => {
    render(
      <BridgeSharedDepsProvider>
        <span>child</span>
      </BridgeSharedDepsProvider>,
    );
    expect(screen.getByText('child')).toBeInTheDocument();
  });

  it('publishes react, react-dom, and react-dom/client on window.__bridgeShared with the same named exports', () => {
    render(
      <BridgeSharedDepsProvider>
        <span>child</span>
      </BridgeSharedDepsProvider>,
    );
    const react = window.__bridgeShared?.react as typeof React;
    const reactDom = window.__bridgeShared?.['react-dom'] as typeof ReactDOM;
    const reactDomClient = window.__bridgeShared?.['react-dom/client'] as typeof ReactDOMClient;
    expect(react.createElement).toBe(React.createElement);
    expect(react.useState).toBe(React.useState);
    expect(reactDom.createPortal).toBe(ReactDOM.createPortal);
    expect(reactDomClient.createRoot).toBe(ReactDOMClient.createRoot);
  });

  it('falls back to the live React.version/ReactDOM.version when no build-time env var is set', () => {
    render(
      <BridgeSharedDepsProvider>
        <span>child</span>
      </BridgeSharedDepsProvider>,
    );
    expect((window.__bridgeShared?.react as { version: string }).version).toBe(React.version);
    expect((window.__bridgeShared?.['react-dom'] as { version: string }).version).toBe(
      ReactDOM.version,
    );
  });

  it('prefers NEXT_PUBLIC_BRIDGE_VERSION_REACT over the live React.version', () => {
    process.env.NEXT_PUBLIC_BRIDGE_VERSION_REACT = '^18.3.0';
    try {
      render(
        <BridgeSharedDepsProvider>
          <span>child</span>
        </BridgeSharedDepsProvider>,
      );
      expect((window.__bridgeShared?.react as { version: string }).version).toBe('^18.3.0');
    } finally {
      delete process.env.NEXT_PUBLIC_BRIDGE_VERSION_REACT;
    }
  });

  it('prefers NEXT_PUBLIC_BRIDGE_VERSION_REACT_DOM for both react-dom and react-dom/client', () => {
    process.env.NEXT_PUBLIC_BRIDGE_VERSION_REACT_DOM = '^18.3.0';
    try {
      render(
        <BridgeSharedDepsProvider>
          <span>child</span>
        </BridgeSharedDepsProvider>,
      );
      expect((window.__bridgeShared?.['react-dom'] as { version: string }).version).toBe(
        '^18.3.0',
      );
      expect((window.__bridgeShared?.['react-dom/client'] as { version: string }).version).toBe(
        '^18.3.0',
      );
    } finally {
      delete process.env.NEXT_PUBLIC_BRIDGE_VERSION_REACT_DOM;
    }
  });

  it('merges shared prop entries into window.__bridgeShared alongside react/react-dom', () => {
    const dateFns = { format: () => 'formatted' };

    render(
      <BridgeSharedDepsProvider shared={{ 'date-fns': { module: dateFns, version: '2.30.0' } }}>
        <span>child</span>
      </BridgeSharedDepsProvider>,
    );

    const published = window.__bridgeShared?.['date-fns'] as { format: () => string; version: string };
    expect(published.format).toBe(dateFns.format);
    expect(published.version).toBe('2.30.0');

    // react/react-dom still publish as usual
    expect((window.__bridgeShared?.react as typeof React).createElement).toBe(React.createElement);
  });

  it('publishes multiple shared entries independently', () => {
    const libA = { foo: () => {} };
    const libB = { bar: () => {} };

    render(
      <BridgeSharedDepsProvider
        shared={{
          'lib-a': { module: libA, version: '1.0.0' },
          'lib-b': { module: libB, version: '2.0.0' },
        }}
      >
        <span>child</span>
      </BridgeSharedDepsProvider>,
    );

    expect((window.__bridgeShared?.['lib-a'] as { version: string }).version).toBe('1.0.0');
    expect((window.__bridgeShared?.['lib-b'] as { version: string }).version).toBe('2.0.0');
  });

  it('does not throw when window is undefined (SSR)', () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error - simulate an SSR environment where `window` does not exist
    delete globalThis.window;

    try {
      // Mirrors Next.js's server-side render pass, which does not have a DOM
      // (unlike @testing-library/react's `render`, which requires jsdom's
      // `window` to be present and so can't be used to simulate this case).
      expect(() =>
        renderToString(
          <BridgeSharedDepsProvider>
            <span>child</span>
          </BridgeSharedDepsProvider>,
        ),
      ).not.toThrow();
    } finally {
      globalThis.window = originalWindow;
    }
  });
});
