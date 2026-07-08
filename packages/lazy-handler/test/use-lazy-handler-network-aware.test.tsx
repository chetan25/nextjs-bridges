import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useLazyHandler } from '../src/use-lazy-handler';
import type { Loader, LazyHandlerOptions } from '../src/types';

vi.mock('../src/network-aware', () => ({
  isDataSaverOrSlowConnection: vi.fn(() => false),
}));

import { isDataSaverOrSlowConnection } from '../src/network-aware';

function TestComponent({
  loader,
  options,
}: {
  loader: Loader;
  options?: LazyHandlerOptions;
}) {
  const [ref] = useLazyHandler<HTMLDivElement>(loader, options);
  return <div ref={ref} data-testid="target" />;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(isDataSaverOrSlowConnection).mockReturnValue(false);
});

describe('useLazyHandler network-awareness', () => {
  it('skips a preloadOn trigger when on a constrained connection', async () => {
    vi.mocked(isDataSaverOrSlowConnection).mockReturnValue(true);
    const handler = vi.fn();
    const loader = vi.fn(() => Promise.resolve({ default: handler }));

    const { getByTestId } = render(
      <TestComponent loader={loader} options={{ preloadOn: 'hover' }} />,
    );
    const el = getByTestId('target');

    await act(async () => {
      el.dispatchEvent(new Event('mouseenter', { bubbles: false }));
      await Promise.resolve();
    });

    expect(loader).not.toHaveBeenCalled();
  });

  it('still loads on the real trigger event even on a constrained connection', async () => {
    vi.mocked(isDataSaverOrSlowConnection).mockReturnValue(true);
    const handler = vi.fn();
    const loader = vi.fn(() => Promise.resolve({ default: handler }));

    const { getByTestId } = render(
      <TestComponent loader={loader} options={{ preloadOn: 'hover' }} />,
    );
    const el = getByTestId('target');

    await act(async () => {
      fireEvent.click(el);
      await Promise.resolve();
    });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('respectConnection=false preloads even on a constrained connection', async () => {
    vi.mocked(isDataSaverOrSlowConnection).mockReturnValue(true);
    const handler = vi.fn();
    const loader = vi.fn(() => Promise.resolve({ default: handler }));

    const { getByTestId } = render(
      <TestComponent
        loader={loader}
        options={{ preloadOn: 'hover', respectConnection: false }}
      />,
    );
    const el = getByTestId('target');

    await act(async () => {
      el.dispatchEvent(new Event('mouseenter', { bubbles: false }));
      await Promise.resolve();
    });

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('preloads normally on an unconstrained connection', async () => {
    vi.mocked(isDataSaverOrSlowConnection).mockReturnValue(false);
    const handler = vi.fn();
    const loader = vi.fn(() => Promise.resolve({ default: handler }));

    const { getByTestId } = render(
      <TestComponent loader={loader} options={{ preloadOn: 'hover' }} />,
    );
    const el = getByTestId('target');

    await act(async () => {
      el.dispatchEvent(new Event('mouseenter', { bubbles: false }));
      await Promise.resolve();
    });

    expect(loader).toHaveBeenCalledTimes(1);
  });
});
