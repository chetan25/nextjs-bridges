import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Interactive } from '../src/interactive';

describe('<Interactive>', () => {
  it('renders children', () => {
    render(
      <Interactive on={{ click: () => Promise.resolve({ default: vi.fn() }) }}>
        <button>Click me</button>
      </Interactive>,
    );
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('renders as span by default', () => {
    const { container } = render(
      <Interactive on={{ click: () => Promise.resolve({ default: vi.fn() }) }}>
        text
      </Interactive>,
    );
    expect(container.querySelector('span')).toBeInTheDocument();
  });

  it('renders as the provided element type via as prop', () => {
    const { container } = render(
      <Interactive as="div" on={{ click: () => Promise.resolve({ default: vi.fn() }) }}>
        text
      </Interactive>,
    );
    expect(container.querySelector('div')).toBeInTheDocument();
    expect(container.querySelector('span')).not.toBeInTheDocument();
  });

  it('loads handler on click', async () => {
    const handler = vi.fn();
    const loader = vi.fn(() => Promise.resolve({ default: handler }));

    render(
      <Interactive on={{ click: loader }}>
        <span data-testid="target">target</span>
      </Interactive>,
    );

    const span = screen.getByTestId('target').parentElement!;
    fireEvent.click(span);
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(1));
  });

  it('passes preloadOn to the hook', () => {
    // Just checks it renders without errors when preloadOn is set
    expect(() =>
      render(
        <Interactive
          on={{ click: () => Promise.resolve({ default: vi.fn() }) }}
          preloadOn="hover"
        >
          child
        </Interactive>,
      ),
    ).not.toThrow();
  });

  it('keeps rendering children while loading when loadingFallback is omitted', async () => {
    let resolveLoader!: (v: { default: () => void }) => void;
    const loader = vi.fn(
      () => new Promise<{ default: () => void }>((r) => { resolveLoader = r; }),
    );

    render(
      <Interactive on={{ click: loader }}>
        <button>Click me</button>
      </Interactive>,
    );

    fireEvent.click(screen.getByRole('button', { name: /click me/i }));
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();

    resolveLoader({ default: vi.fn() });
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(1));
  });

  it('renders loadingFallback while the loader is pending, then reverts to children once it resolves', async () => {
    let resolveLoader!: (v: { default: () => void }) => void;
    const loader = vi.fn(
      () => new Promise<{ default: () => void }>((r) => { resolveLoader = r; }),
    );

    render(
      <Interactive on={{ click: loader }} loadingFallback={<span>Loading...</span>}>
        <button>Click me</button>
      </Interactive>,
    );

    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /click me/i }));

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /click me/i })).not.toBeInTheDocument();

    resolveLoader({ default: vi.fn() });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument(),
    );
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('keeps the wrapping element identity stable while swapping between children and loadingFallback', async () => {
    let resolveLoader!: (v: { default: () => void }) => void;
    const loader = vi.fn(
      () => new Promise<{ default: () => void }>((r) => { resolveLoader = r; }),
    );

    const { container } = render(
      <Interactive
        as="div"
        on={{ click: loader }}
        loadingFallback={<span>Loading...</span>}
      >
        <button>Click me</button>
      </Interactive>,
    );

    const wrapper = container.querySelector('div');
    expect(wrapper).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /click me/i }));
    expect(container.querySelector('div')).toBe(wrapper);

    resolveLoader({ default: vi.fn() });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument(),
    );
    expect(container.querySelector('div')).toBe(wrapper);
  });

  it('renders errorFallback when the loader rejects, and calls onError', async () => {
    const onError = vi.fn();
    const loader = vi.fn(() => Promise.reject(new Error('load failed')));

    render(
      <Interactive
        on={{ click: loader }}
        errorFallback={(error) => <span>Failed: {error.message}</span>}
        onError={onError}
      >
        <button>Click me</button>
      </Interactive>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /click me/i }));
      await Promise.resolve();
    });

    expect(screen.getByText('Failed: load failed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /click me/i })).not.toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'load failed' }));
  });

  it('keeps rendering children on load failure when errorFallback is omitted', async () => {
    const loader = vi.fn(() => Promise.reject(new Error('load failed')));

    render(
      <Interactive on={{ click: loader }}>
        <button>Click me</button>
      </Interactive>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /click me/i }));
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });
});
