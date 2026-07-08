import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, render, screen, waitFor } from '@testing-library/react';
import { createRemoteRegistry } from '../src/remote-registry';

vi.mock('../src/use-remote-component', () => ({
  useRemoteComponent: vi.fn(),
}));

vi.mock('../src/preload-remote-component', () => ({
  preloadRemoteComponent: vi.fn(),
}));

import { useRemoteComponent } from '../src/use-remote-component';
import { preloadRemoteComponent } from '../src/preload-remote-component';

function mockMount(container: HTMLElement) {
  const el = document.createElement('div');
  el.textContent = 'mounted';
  container.appendChild(el);
  return () => { el.remove(); };
}

describe('createRemoteRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useRemoteComponent binds the manifest URL so callers only pass the expose name', () => {
    vi.mocked(useRemoteComponent).mockReturnValue({ mount: null, loading: true, error: null });

    const registry = createRemoteRegistry('http://localhost:3001/share-manifest.json');
    renderHook(() => registry.useRemoteComponent('./Button'));

    expect(useRemoteComponent).toHaveBeenCalledWith(
      'http://localhost:3001/share-manifest.json',
      './Button',
      undefined,
      {},
    );
  });

  it('useRemoteComponent forwards requiredVersion and merges default options with per-call overrides', () => {
    vi.mocked(useRemoteComponent).mockReturnValue({ mount: null, loading: true, error: null });

    const registry = createRemoteRegistry('http://localhost:3001/share-manifest.json', {
      hotReload: true,
      hotReloadInterval: 5000,
    });
    renderHook(() =>
      registry.useRemoteComponent('./Button', '^1.0.0', { hotReloadInterval: 1000 }),
    );

    expect(useRemoteComponent).toHaveBeenCalledWith(
      'http://localhost:3001/share-manifest.json',
      './Button',
      '^1.0.0',
      { hotReload: true, hotReloadInterval: 1000 },
    );
  });

  it('RemoteComponent renders with the bound manifest URL', async () => {
    vi.mocked(useRemoteComponent).mockReturnValue({ mount: mockMount, loading: false, error: null });

    const registry = createRemoteRegistry('http://localhost:3001/share-manifest.json');
    render(<registry.RemoteComponent expose="./Button" />);

    await waitFor(() => expect(screen.getByText('mounted')).toBeInTheDocument());
    expect(useRemoteComponent).toHaveBeenCalledWith(
      'http://localhost:3001/share-manifest.json',
      './Button',
      undefined,
      { hotReload: false },
    );
  });

  it('preload binds the manifest URL and delegates to preloadRemoteComponent', async () => {
    vi.mocked(preloadRemoteComponent).mockResolvedValue(undefined);

    const registry = createRemoteRegistry('http://localhost:3001/share-manifest.json');
    await registry.preload('./CartWidget');

    expect(preloadRemoteComponent).toHaveBeenCalledWith(
      'http://localhost:3001/share-manifest.json',
      './CartWidget',
      undefined,
    );
  });

  it('preload forwards options (e.g. fetchPriority) to preloadRemoteComponent', async () => {
    vi.mocked(preloadRemoteComponent).mockResolvedValue(undefined);

    const registry = createRemoteRegistry('http://localhost:3001/share-manifest.json');
    await registry.preload('./CartWidget', { fetchPriority: 'high' });

    expect(preloadRemoteComponent).toHaveBeenCalledWith(
      'http://localhost:3001/share-manifest.json',
      './CartWidget',
      { fetchPriority: 'high' },
    );
  });
});
