import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { HydrationBoundary } from '../src/hydration-boundary';
import { useHydrationState } from '../src/use-hydration-state';
import { withHydrationBoundary } from '../src/hoc';

// Mock IntersectionObserver for jsdom
let observerCallback: IntersectionObserverCallback;
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn((cb: IntersectionObserverCallback) => {
      observerCallback = cb;
      return { observe: mockObserve, disconnect: mockDisconnect, unobserve: vi.fn() };
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function Child() {
  return <div data-testid="child">hydrated child</div>;
}

describe('HydrationBoundary', () => {
  it('renders fallback initially for non-eager strategies', () => {
    render(
      <HydrationBoundary strategy="visible" fallback={<div data-testid="fallback" />}>
        <Child />
      </HydrationBoundary>,
    );
    expect(screen.getByTestId('fallback')).toBeInTheDocument();
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
  });

  it('renders children immediately for eager strategy', () => {
    render(
      <HydrationBoundary strategy="eager" fallback={<div data-testid="fallback" />}>
        <Child />
      </HydrationBoundary>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();
  });

  it('visible strategy hydrates when IntersectionObserver fires', async () => {
    render(
      <HydrationBoundary strategy="visible" fallback={<div data-testid="fallback" />}>
        <Child />
      </HydrationBoundary>,
    );

    expect(screen.getByTestId('fallback')).toBeInTheDocument();

    await act(async () => {
      observerCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('visible strategy does not hydrate when element is not intersecting', async () => {
    render(
      <HydrationBoundary strategy="visible" fallback={<div data-testid="fallback" />}>
        <Child />
      </HydrationBoundary>,
    );

    await act(async () => {
      observerCallback(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
  });

  it('idle strategy hydrates via setTimeout fallback when requestIdleCallback absent', async () => {
    vi.useFakeTimers();
    const ric = (window as Record<string, unknown>).requestIdleCallback;
    delete (window as Record<string, unknown>).requestIdleCallback;

    render(
      <HydrationBoundary strategy="idle" fallback={<div data-testid="fallback" />}>
        <Child />
      </HydrationBoundary>,
    );

    expect(screen.getByTestId('fallback')).toBeInTheDocument();

    await act(async () => {
      vi.runAllTimers();
    });

    expect(screen.getByTestId('child')).toBeInTheDocument();

    (window as Record<string, unknown>).requestIdleCallback = ric;
    vi.useRealTimers();
  });

  it('interaction strategy hydrates on pointerenter', async () => {
    render(
      <HydrationBoundary strategy="interaction" fallback={<div data-testid="fallback" />}>
        <Child />
      </HydrationBoundary>,
    );

    // The boundary wrapper div is the parent of the fallback
    const boundary = screen.getByTestId('fallback').parentElement!;

    await act(async () => {
      fireEvent.pointerEnter(boundary);
    });

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('manual strategy: hydrateNow() in fallback slot triggers hydration', async () => {
    // The Context Provider wraps both fallback and children, so a component
    // rendered in the fallback slot can call hydrateNow() to trigger hydration.
    function FallbackWithButton() {
      const { hydrateNow } = useHydrationState();
      return <button onClick={hydrateNow}>hydrate</button>;
    }

    render(
      <HydrationBoundary strategy="manual" fallback={<FallbackWithButton />}>
        <Child />
      </HydrationBoundary>,
    );

    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    await waitFor(() => expect(screen.getByTestId('child')).toBeInTheDocument());
  });

  it('calls onHydrate callback once when hydration triggers', async () => {
    const onHydrate = vi.fn();

    render(
      <HydrationBoundary strategy="visible" fallback={null} onHydrate={onHydrate}>
        <Child />
      </HydrationBoundary>,
    );

    await act(async () => {
      observerCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(onHydrate).toHaveBeenCalledTimes(1);
  });

  it('withHydrationBoundary HOC wraps component and passes props through', () => {
    const Wrapped = withHydrationBoundary(Child, { strategy: 'eager' });
    render(<Wrapped />);
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('useHydrationState returns hydrated=true when called outside a boundary', () => {
    function StandaloneConsumer() {
      const { hydrated } = useHydrationState();
      return <span data-testid="status">{hydrated ? 'yes' : 'no'}</span>;
    }
    render(<StandaloneConsumer />);
    expect(screen.getByTestId('status')).toHaveTextContent('yes');
  });

  describe('loader prop (code-splitting)', () => {
    function LazyChild({ label }: { label: string }) {
      return <div data-testid="lazy-child">{label}</div>;
    }

    it('does not call loader before the strategy fires', async () => {
      const loader = vi.fn(() => Promise.resolve({ default: LazyChild }));

      render(
        <HydrationBoundary
          strategy="visible"
          fallback={<div data-testid="fallback" />}
          loader={loader}
          componentProps={{ label: 'hi' }}
        />,
      );

      expect(screen.getByTestId('fallback')).toBeInTheDocument();
      expect(loader).not.toHaveBeenCalled();

      await act(async () => {
        observerCallback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        );
      });

      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('calls loader once and renders the resolved component with componentProps once hydrated', async () => {
      let resolveLoader!: (v: { default: typeof LazyChild }) => void;
      const loader = vi.fn(
        () => new Promise<{ default: typeof LazyChild }>((r) => { resolveLoader = r; }),
      );

      render(
        <HydrationBoundary
          strategy="eager"
          fallback={<div data-testid="fallback" />}
          loader={loader}
          componentProps={{ label: 'hello' }}
        />,
      );

      expect(loader).toHaveBeenCalledTimes(1);
      // Chunk still in flight — Suspense shows the same fallback.
      expect(screen.getByTestId('fallback')).toBeInTheDocument();
      expect(screen.queryByTestId('lazy-child')).not.toBeInTheDocument();

      await act(async () => {
        resolveLoader({ default: LazyChild });
        await Promise.resolve();
      });

      expect(screen.getByTestId('lazy-child')).toHaveTextContent('hello');
    });

    it('does not call loader again when the boundary re-renders with a fresh inline loader function', async () => {
      const loader = vi.fn(() => Promise.resolve({ default: LazyChild }));

      function Wrapper() {
        const [, setTick] = useState(0);
        return (
          <div>
            <button onClick={() => setTick((t) => t + 1)}>tick</button>
            <HydrationBoundary
              strategy="eager"
              fallback={<div data-testid="fallback" />}
              loader={() => loader()}
              componentProps={{ label: 'stable' }}
            />
          </div>
        );
      }

      render(<Wrapper />);
      expect(loader).toHaveBeenCalledTimes(1);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'tick' }));
      });

      expect(loader).toHaveBeenCalledTimes(1);
    });
  });
});
