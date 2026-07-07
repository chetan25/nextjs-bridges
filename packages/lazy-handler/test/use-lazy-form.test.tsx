import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useLazyForm } from '../src/use-lazy-form';
import type { UseLazyFormOptions } from '../src/use-lazy-form';
import type { FormLoader } from '../src/types';

function TestForm({
  loader,
  options,
}: {
  loader: FormLoader;
  options?: UseLazyFormOptions;
}) {
  const [ref, isLoading] = useLazyForm(loader, options);
  return <form ref={ref} data-testid="form" data-loading={String(isLoading)} />;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('useLazyForm', () => {
  it('prevents the native submit synchronously, even before the handler module loads', () => {
    const loader = vi.fn(() => new Promise<{ default: () => void }>(() => {}));
    const { getByTestId } = render(<TestForm loader={loader} />);
    const form = getByTestId('form') as HTMLFormElement;

    const event = new Event('submit', { bubbles: true, cancelable: true });
    act(() => {
      form.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
  });

  it('loads the handler on first submit and invokes it with the event', async () => {
    const handler = vi.fn();
    const loader = vi.fn(() => Promise.resolve({ default: handler }));
    const { getByTestId } = render(<TestForm loader={loader} />);
    const form = getByTestId('form');

    await act(async () => {
      fireEvent.submit(form);
      await Promise.resolve();
    });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('prevents default again on a warm (already-loaded) submit', async () => {
    const handler = vi.fn();
    const loader = vi.fn(() => Promise.resolve({ default: handler }));
    const { getByTestId } = render(<TestForm loader={loader} />);
    const form = getByTestId('form') as HTMLFormElement;

    await act(async () => {
      fireEvent.submit(form);
      await Promise.resolve();
    });

    const event = new Event('submit', { bubbles: true, cancelable: true });
    act(() => {
      form.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('isLoading reflects the in-flight load and resolves once the handler is ready', async () => {
    let resolveLoader!: (v: { default: () => void }) => void;
    const loader = vi.fn(
      () => new Promise<{ default: () => void }>((r) => { resolveLoader = r; }),
    );
    const { getByTestId } = render(<TestForm loader={loader} />);
    const form = getByTestId('form');
    expect(form).toHaveAttribute('data-loading', 'false');

    fireEvent.submit(form);
    expect(form).toHaveAttribute('data-loading', 'true');

    await act(async () => {
      resolveLoader({ default: vi.fn() });
      await Promise.resolve();
    });

    expect(form).toHaveAttribute('data-loading', 'false');
  });

  it('supports preloadOn to fetch the handler before submission', async () => {
    vi.useFakeTimers();
    const handler = vi.fn();
    const loader = vi.fn(() => Promise.resolve({ default: handler }));

    render(<TestForm loader={loader} options={{ preloadOn: 'idle' }} />);

    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(handler).not.toHaveBeenCalled();
  });
});
