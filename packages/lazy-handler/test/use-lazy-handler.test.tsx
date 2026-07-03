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
  const [ref] = useLazyHandler<HTMLDivElement>(loader, options);
  return <div ref={ref} data-testid="target" />;
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
});
