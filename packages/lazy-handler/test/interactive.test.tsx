import { render, screen, fireEvent } from '@testing-library/react';
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
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(1));
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
});
