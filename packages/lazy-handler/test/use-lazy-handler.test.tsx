import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useRef, useState } from 'react';
import { useLazyHandler } from '../src/use-lazy-handler';
import type { Loader, LazyHandlerOptions } from '../src/types';

// Renders a div wired up to useLazyHandler and returns the element
function TestComponent({
  loader,
  options,
}: {
  loader: Loader;
  options?: LazyHandlerOptions;
}) {
  const [ref, , isLoading, error] = useLazyHandler<HTMLDivElement>(loader, options);
  return (
    <div
      ref={ref}
      data-testid="target"
      data-loading={String(isLoading)}
      data-error={error ? error.message : ''}
    />
  );
}

// Mirrors CartWidget's checkout button: the ref target doesn't exist on
// initial render — it only mounts once `show` flips true.
function ConditionallyMountedTestComponent({
  loader,
  options,
}: {
  loader: Loader;
  options?: LazyHandlerOptions;
}) {
  const [show, setShow] = useState(false);
  const [ref] = useLazyHandler<HTMLDivElement>(loader, options);
  return (
    <div>
      <button data-testid="toggle" onClick={() => setShow(true)}>
        show
      </button>
      {show && <div ref={ref} data-testid="target" />}
    </div>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('useLazyHandler', () => {
  it('loads handler on first click and invokes it with the event', async () => {
    const handler = vi.fn();
    const loader = vi.fn(() => Promise.resolve({ default: handler }));

    const { getByTestId } = render(<TestComponent loader={loader} />);
    const el = getByTestId('target');

    await act(async () => {
      fireEvent.click(el);
      await Promise.resolve();
    });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('serves cached handler on subsequent clicks without reloading', async () => {
    const handler = vi.fn();
    const loader = vi.fn(() => Promise.resolve({ default: handler }));

    const { getByTestId } = render(<TestComponent loader={loader} />);
    const el = getByTestId('target');

    await act(async () => {
      fireEvent.click(el);
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.click(el);
      await Promise.resolve();
    });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('guards against double-load on rapid clicks while import is in-flight', async () => {
    let resolveLoader!: (v: { default: typeof handler }) => void;
    const handler = vi.fn();
    const loader = vi.fn(
      () => new Promise<{ default: typeof handler }>((r) => { resolveLoader = r; }),
    );

    const { getByTestId } = render(<TestComponent loader={loader} />);
    const el = getByTestId('target');

    // Two rapid clicks before loader resolves
    fireEvent.click(el);
    fireEvent.click(el);

    await act(async () => {
      resolveLoader({ default: handler });
      await Promise.resolve();
    });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('preloads on mouseenter before first click when preloadOn=hover', async () => {
    const handler = vi.fn();
    const loader = vi.fn(() => Promise.resolve({ default: handler }));

    const { getByTestId } = render(
      <TestComponent loader={loader} options={{ preloadOn: 'hover' }} />,
    );
    const el = getByTestId('target');

    await act(async () => {
      // preloadOn='hover' maps to the 'mouseenter' DOM event (not 'hover')
      el.dispatchEvent(new Event('mouseenter', { bubbles: false }));
      await Promise.resolve();
    });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(handler).not.toHaveBeenCalled();
  });

  it('preloads on focusin before first click when preloadOn=focus', async () => {
    const handler = vi.fn();
    const loader = vi.fn(() => Promise.resolve({ default: handler }));

    const { getByTestId } = render(
      <TestComponent loader={loader} options={{ preloadOn: 'focus' }} />,
    );
    const el = getByTestId('target');

    await act(async () => {
      // preloadOn='focus' maps to the 'focusin' DOM event
      el.dispatchEvent(new Event('focusin', { bubbles: true }));
      await Promise.resolve();
    });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not error when component unmounts before loader resolves', async () => {
    let resolveLoader!: (v: { default: typeof handler }) => void;
    const handler = vi.fn();
    const loader = vi.fn(
      () => new Promise<{ default: typeof handler }>((r) => { resolveLoader = r; }),
    );

    const { getByTestId, unmount } = render(<TestComponent loader={loader} />);
    const el = getByTestId('target');

    fireEvent.click(el);

    unmount();

    await act(async () => {
      resolveLoader({ default: handler });
      await Promise.resolve();
    });

    // Should not throw; handler should NOT be called (cancelled=true)
    expect(handler).not.toHaveBeenCalled();
  });

  it('attaches the listener when the ref target mounts after initial render', async () => {
    const handler = vi.fn();
    const loader = vi.fn(() => Promise.resolve({ default: handler }));

    const { getByTestId, queryByTestId } = render(
      <ConditionallyMountedTestComponent loader={loader} />,
    );

    expect(queryByTestId('target')).toBeNull();

    await act(async () => {
      fireEvent.click(getByTestId('toggle'));
    });

    const el = getByTestId('target');

    await act(async () => {
      fireEvent.click(el);
      await Promise.resolve();
    });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('preloads on idle when preloadOn is "idle"', async () => {
    vi.useFakeTimers();
    const handler = vi.fn();
    const loader = vi.fn(() => Promise.resolve({ default: handler }));

    render(<TestComponent loader={loader} options={{ preloadOn: 'idle' }} />);

    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(handler).not.toHaveBeenCalled();
  });

  it('preloads via whichever of multiple strategies fires first, and ignores the rest', async () => {
    vi.useFakeTimers();
    const handler = vi.fn();
    const loader = vi.fn(() => Promise.resolve({ default: handler }));

    const { getByTestId } = render(
      <TestComponent loader={loader} options={{ preloadOn: ['hover', 'idle'] }} />,
    );
    const el = getByTestId('target');

    // Hover fires first — this alone should trigger exactly one load.
    await act(async () => {
      el.dispatchEvent(new Event('mouseenter', { bubbles: false }));
      await Promise.resolve();
    });

    expect(loader).toHaveBeenCalledTimes(1);

    // The idle timer firing afterward must be a no-op (already loaded).
    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('cancels the pending idle preload on unmount', async () => {
    vi.useFakeTimers();
    const handler = vi.fn();
    const loader = vi.fn(() => Promise.resolve({ default: handler }));

    const { unmount } = render(
      <TestComponent loader={loader} options={{ preloadOn: 'idle' }} />,
    );

    unmount();

    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });

    expect(loader).not.toHaveBeenCalled();
  });

  it('isLoading starts false', () => {
    const loader = vi.fn(() => Promise.resolve({ default: vi.fn() }));
    const { getByTestId } = render(<TestComponent loader={loader} />);
    expect(getByTestId('target')).toHaveAttribute('data-loading', 'false');
  });

  it('isLoading becomes true while the loader is in flight and false once it settles', async () => {
    let resolveLoader!: (v: { default: () => void }) => void;
    const loader = vi.fn(
      () => new Promise<{ default: () => void }>((r) => { resolveLoader = r; }),
    );

    const { getByTestId } = render(<TestComponent loader={loader} />);
    const el = getByTestId('target');
    expect(el).toHaveAttribute('data-loading', 'false');

    fireEvent.click(el);
    // Loader called synchronously by the stub, before the promise settles.
    expect(el).toHaveAttribute('data-loading', 'true');

    await act(async () => {
      resolveLoader({ default: vi.fn() });
      await Promise.resolve();
    });

    expect(el).toHaveAttribute('data-loading', 'false');
  });

  it('isLoading becomes true during a hover preload and false once it settles', async () => {
    let resolveLoader!: (v: { default: () => void }) => void;
    const loader = vi.fn(
      () => new Promise<{ default: () => void }>((r) => { resolveLoader = r; }),
    );

    const { getByTestId } = render(
      <TestComponent loader={loader} options={{ preloadOn: 'hover' }} />,
    );
    const el = getByTestId('target');

    act(() => {
      el.dispatchEvent(new Event('mouseenter', { bubbles: false }));
    });
    expect(el).toHaveAttribute('data-loading', 'true');

    await act(async () => {
      resolveLoader({ default: vi.fn() });
      await Promise.resolve();
    });

    expect(el).toHaveAttribute('data-loading', 'false');
  });

  it('does not re-trigger isLoading on click after a preload already resolved it', async () => {
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
    expect(el).toHaveAttribute('data-loading', 'false');

    await act(async () => {
      fireEvent.click(el);
      await Promise.resolve();
    });

    expect(el).toHaveAttribute('data-loading', 'false');
    expect(loader).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('isLoading returns to false after a rejected loader, and can cycle true again on retry', async () => {
    let rejectLoader!: (e: Error) => void;
    const handler = vi.fn();
    const loader = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise((_, rej) => { rejectLoader = rej; }),
      )
      .mockImplementationOnce(() => Promise.resolve({ default: handler }));

    const { getByTestId } = render(<TestComponent loader={loader} />);
    const el = getByTestId('target');

    fireEvent.click(el);
    expect(el).toHaveAttribute('data-loading', 'true');

    await act(async () => {
      rejectLoader(new Error('load failed'));
      await Promise.resolve();
    });
    expect(el).toHaveAttribute('data-loading', 'false');

    await act(async () => {
      fireEvent.click(el);
      await Promise.resolve();
    });

    expect(loader).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(el).toHaveAttribute('data-loading', 'false');
  });

  it('sets error when the loader rejects, and calls onError with the normalized error', async () => {
    const onError = vi.fn();
    const loader = vi.fn(() => Promise.reject(new Error('network blip')));

    const { getByTestId } = render(
      <TestComponent loader={loader} options={{ onError }} />,
    );
    const el = getByTestId('target');

    await act(async () => {
      fireEvent.click(el);
      await Promise.resolve();
    });

    expect(el).toHaveAttribute('data-error', 'network blip');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'network blip' }));
  });

  it('normalizes a non-Error rejection into an Error', async () => {
    const loader = vi.fn(() => Promise.reject('plain string rejection'));

    const { getByTestId } = render(<TestComponent loader={loader} />);
    const el = getByTestId('target');

    await act(async () => {
      fireEvent.click(el);
      await Promise.resolve();
    });

    expect(el).toHaveAttribute('data-error', 'plain string rejection');
  });

  it('clears a prior error once a retry starts loading again', async () => {
    let rejectLoader!: (e: Error) => void;
    const handler = vi.fn();
    const loader = vi
      .fn()
      .mockImplementationOnce(() => new Promise((_, rej) => { rejectLoader = rej; }))
      .mockImplementationOnce(() => Promise.resolve({ default: handler }));

    const { getByTestId } = render(<TestComponent loader={loader} />);
    const el = getByTestId('target');

    fireEvent.click(el);
    await act(async () => {
      rejectLoader(new Error('first attempt failed'));
      await Promise.resolve();
    });
    expect(el).toHaveAttribute('data-error', 'first attempt failed');

    await act(async () => {
      fireEvent.click(el);
      await Promise.resolve();
    });
    expect(el).toHaveAttribute('data-error', '');
  });

  it('does not call onError after unmount', async () => {
    const onError = vi.fn();
    let rejectLoader!: (e: Error) => void;
    const loader = vi.fn(() => new Promise((_, rej) => { rejectLoader = rej; }));

    const { getByTestId, unmount } = render(
      <TestComponent loader={loader} options={{ onError }} />,
    );
    const el = getByTestId('target');

    fireEvent.click(el);
    unmount();

    await act(async () => {
      rejectLoader(new Error('too late'));
      await Promise.resolve();
    });

    expect(onError).not.toHaveBeenCalled();
  });

  it('calls preventDefault synchronously on interception when preventDefault=true', () => {
    const loader = vi.fn(() => new Promise<{ default: () => void }>(() => {}));
    const { getByTestId } = render(
      <TestComponent loader={loader} options={{ event: 'submit', preventDefault: true }} />,
    );
    const el = getByTestId('target');

    const event = new Event('submit', { bubbles: true, cancelable: true });
    act(() => {
      el.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
  });

  it('does not call preventDefault when preventDefault is unset (default click behavior unaffected)', () => {
    const loader = vi.fn(() => new Promise<{ default: () => void }>(() => {}));
    const { getByTestId } = render(<TestComponent loader={loader} />);
    const el = getByTestId('target');

    const event = new Event('click', { bubbles: true, cancelable: true });
    act(() => {
      el.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(false);
  });

  it('does not warn or throw when unmounting mid-load', async () => {
    let resolveLoader!: (v: { default: () => void }) => void;
    const loader = vi.fn(
      () => new Promise<{ default: () => void }>((r) => { resolveLoader = r; }),
    );
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { getByTestId, unmount } = render(<TestComponent loader={loader} />);
    const el = getByTestId('target');

    fireEvent.click(el);
    unmount();

    await act(async () => {
      resolveLoader({ default: vi.fn() });
      await Promise.resolve();
    });

    expect(consoleError).not.toHaveBeenCalled();
  });
});
