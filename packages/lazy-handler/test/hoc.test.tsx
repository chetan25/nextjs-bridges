import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { withLazyHandlers } from '../src/hoc';

function Button({
  onClick,
  onMouseEnter,
  children,
}: {
  onClick?: (e: Event) => void;
  onMouseEnter?: (e: Event) => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick as React.MouseEventHandler}
      onMouseEnter={onMouseEnter as React.MouseEventHandler}
    >
      {children}
    </button>
  );
}

describe('withLazyHandlers', () => {
  it('replaces the primary event handler with a lazy stub', async () => {
    const handler = vi.fn();
    const loader = vi.fn(() => Promise.resolve({ default: handler }));

    const LazyButton = withLazyHandlers(Button, { click: loader });
    render(<LazyButton>click me</LazyButton>);

    const btn = screen.getByRole('button');

    await act(async () => {
      fireEvent.click(btn);
      await Promise.resolve();
    });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not override secondary handlers already on the wrapped component', async () => {
    const handler = vi.fn();
    const loader = vi.fn(() => Promise.resolve({ default: handler }));
    const enterHandler = vi.fn();

    const LazyButton = withLazyHandlers(Button, { click: loader });
    render(<LazyButton onMouseEnter={enterHandler}>click me</LazyButton>);

    const btn = screen.getByRole('button');
    fireEvent.mouseEnter(btn);

    expect(enterHandler).toHaveBeenCalledTimes(1);
  });

  it('serves cached handler on subsequent clicks without reloading', async () => {
    const handler = vi.fn();
    const loader = vi.fn(() => Promise.resolve({ default: handler }));

    const LazyButton = withLazyHandlers(Button, { click: loader });
    render(<LazyButton>click me</LazyButton>);

    const btn = screen.getByRole('button');

    await act(async () => {
      fireEvent.click(btn);
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.click(btn);
      await Promise.resolve();
    });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('sets a displayName for easier debugging', () => {
    const loader = vi.fn(() => Promise.resolve({ default: vi.fn() }));
    const LazyButton = withLazyHandlers(Button, { click: loader });
    expect(LazyButton.displayName).toBe('withLazyHandlers(Button)');
  });
});
