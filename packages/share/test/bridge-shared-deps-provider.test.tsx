import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('publishes react, react-dom, and react-dom/client on window.__bridgeShared', () => {
    render(
      <BridgeSharedDepsProvider>
        <span>child</span>
      </BridgeSharedDepsProvider>,
    );
    expect(window.__bridgeShared?.react).toBe(React);
    expect(window.__bridgeShared?.['react-dom']).toBe(ReactDOM);
    expect(window.__bridgeShared?.['react-dom/client']).toBe(ReactDOMClient);
  });
});
