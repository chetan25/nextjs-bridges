import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useRemoteComponent } from '../src/use-remote-component';

vi.mock('../src/manifest-loader', () => ({
  loadManifest: vi.fn(),
}));

vi.mock('../src/chunk-loader', () => ({
  loadChunk: vi.fn(),
}));

vi.mock('../src/chunk-watcher', () => ({
  watchChunkForChanges: vi.fn(() => vi.fn()),
}));

import { loadManifest } from '../src/manifest-loader';
import { loadChunk } from '../src/chunk-loader';
import { watchChunkForChanges } from '../src/chunk-watcher';

declare global {
  interface Window {
    __bridgeShared?: Record<string, unknown>;
  }
}

const mockManifest = {
  name: 'host-app',
  version: '1.0.0',
  baseUrl: 'http://localhost:3001',
  exposes: {
    './Button': { chunk: '/button.chunk.js', version: '1.0.0' },
  },
};

// A minimal mount function — appends a sentinel child and returns a cleanup.
function mockMount(container: HTMLElement, _props: Record<string, unknown>) {
  const sentinel = document.createElement('div');
  sentinel.textContent = 'mock';
  container.appendChild(sentinel);
  return () => { sentinel.remove(); };
}

describe('useRemoteComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in loading state', () => {
    vi.mocked(loadManifest).mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() =>
      useRemoteComponent('http://example.com/manifest.json', './Button'),
    );
    expect(result.current.loading).toBe(true);
    expect(result.current.mount).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('resolves to mount function on success', async () => {
    vi.mocked(loadManifest).mockResolvedValue(mockManifest);
    vi.mocked(loadChunk).mockResolvedValue({ default: mockMount });

    const { result } = renderHook(() =>
      useRemoteComponent('http://example.com/manifest.json', './Button'),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.mount).toBe(mockMount);
      expect(result.current.error).toBeNull();
    });
  });

  it('builds absolute chunk URL from baseUrl + chunk path', async () => {
    vi.mocked(loadManifest).mockResolvedValue(mockManifest);
    vi.mocked(loadChunk).mockResolvedValue({ default: mockMount });

    renderHook(() =>
      useRemoteComponent('http://example.com/manifest.json', './Button'),
    );

    await waitFor(() =>
      expect(vi.mocked(loadChunk)).toHaveBeenCalledWith(
        'http://localhost:3001/button.chunk.js',
      ),
    );
  });

  it('uses absolute chunk URL directly when entry.chunk starts with http', async () => {
    const manifest = {
      ...mockManifest,
      exposes: {
        './Button': { chunk: 'https://cdn.example.com/button.chunk.js', version: '1.0.0' },
      },
    };
    vi.mocked(loadManifest).mockResolvedValue(manifest);
    vi.mocked(loadChunk).mockResolvedValue({ default: mockMount });

    renderHook(() =>
      useRemoteComponent('http://example.com/manifest.json', './Button'),
    );

    await waitFor(() =>
      expect(vi.mocked(loadChunk)).toHaveBeenCalledWith(
        'https://cdn.example.com/button.chunk.js',
      ),
    );
  });

  it('sets error on manifest fetch failure', async () => {
    vi.mocked(loadManifest).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useRemoteComponent('http://example.com/manifest.json', './Button'),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error?.message).toContain('Network error');
      expect(result.current.mount).toBeNull();
    });
  });

  it('sets error when expose is not found in manifest', async () => {
    vi.mocked(loadManifest).mockResolvedValue(mockManifest);

    const { result } = renderHook(() =>
      useRemoteComponent('http://example.com/manifest.json', './Missing'),
    );

    await waitFor(() => {
      expect(result.current.error?.message).toContain('"./Missing" not found');
    });
  });

  it('sets error on version mismatch when requiredVersion is set', async () => {
    vi.mocked(loadManifest).mockResolvedValue(mockManifest); // exposes version is '1.0.0'

    const { result } = renderHook(() =>
      useRemoteComponent('http://example.com/manifest.json', './Button', '^2.0.0'),
    );

    await waitFor(() => {
      expect(result.current.error?.message).toContain('Version mismatch');
    });
  });

  it('throws a version-mismatch error when a shared dep has drifted', async () => {
    window.__bridgeShared = { react: { version: '19.0.0' } };
    vi.mocked(loadManifest).mockResolvedValue({
      ...mockManifest,
      shared: { react: { version: '18.3.0', external: true } },
    });

    const { result } = renderHook(() =>
      useRemoteComponent('http://example.com/manifest.json', './Button'),
    );

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toContain('Version mismatch');
    window.__bridgeShared = undefined;
  });

  it('does not update state after unmount', async () => {
    let resolveManifest!: (m: typeof mockManifest) => void;
    vi.mocked(loadManifest).mockReturnValue(
      new Promise<typeof mockManifest>((res) => {
        resolveManifest = res;
      }),
    );

    const { result, unmount } = renderHook(() =>
      useRemoteComponent('http://example.com/manifest.json', './Button'),
    );

    unmount();
    // Resolve after unmount — cancelled flag prevents setState
    act(() => { resolveManifest(mockManifest); });

    expect(result.current.mount).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('re-fetches when manifestUrl changes', async () => {
    vi.mocked(loadManifest).mockResolvedValue(mockManifest);
    vi.mocked(loadChunk).mockResolvedValue({ default: mockMount });

    const { rerender } = renderHook(
      ({ url }: { url: string }) => useRemoteComponent(url, './Button'),
      { initialProps: { url: 'http://example.com/manifest-a.json' } },
    );

    await waitFor(() => expect(vi.mocked(loadManifest)).toHaveBeenCalledTimes(1));

    rerender({ url: 'http://example.com/manifest-b.json' });
    await waitFor(() => expect(vi.mocked(loadManifest)).toHaveBeenCalledTimes(2));
  });

  describe('hotReload option', () => {
    it('does not start watching when hotReload is not set', async () => {
      vi.mocked(loadManifest).mockResolvedValue(mockManifest);
      vi.mocked(loadChunk).mockResolvedValue({ default: mockMount });

      const { result } = renderHook(() =>
        useRemoteComponent('http://example.com/manifest.json', './Button'),
      );

      await waitFor(() => expect(result.current.mount).toBe(mockMount));
      expect(watchChunkForChanges).not.toHaveBeenCalled();
    });

    it('starts watching the resolved chunk URL once the initial load succeeds, when hotReload is true', async () => {
      vi.mocked(loadManifest).mockResolvedValue(mockManifest);
      vi.mocked(loadChunk).mockResolvedValue({ default: mockMount });

      const { result } = renderHook(() =>
        useRemoteComponent('http://example.com/manifest.json', './Button', undefined, {
          hotReload: true,
          hotReloadInterval: 3000,
        }),
      );

      await waitFor(() => expect(result.current.mount).toBe(mockMount));
      expect(watchChunkForChanges).toHaveBeenCalledWith(
        'http://localhost:3001/button.chunk.js',
        expect.any(Function),
        { interval: 3000 },
      );
    });

    it('swaps mount to the newly loaded module when the watcher reports a change', async () => {
      vi.mocked(loadManifest).mockResolvedValue(mockManifest);
      vi.mocked(loadChunk).mockResolvedValue({ default: mockMount });

      const { result } = renderHook(() =>
        useRemoteComponent('http://example.com/manifest.json', './Button', undefined, {
          hotReload: true,
        }),
      );

      await waitFor(() => expect(result.current.mount).toBe(mockMount));

      const onChange = vi.mocked(watchChunkForChanges).mock.calls[0][1];
      const newMount = () => document.createElement('div');
      act(() => {
        onChange({ default: newMount });
      });

      expect(result.current.mount).toBe(newMount);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('stops watching on unmount', async () => {
      const stopWatching = vi.fn();
      vi.mocked(watchChunkForChanges).mockReturnValue(stopWatching);
      vi.mocked(loadManifest).mockResolvedValue(mockManifest);
      vi.mocked(loadChunk).mockResolvedValue({ default: mockMount });

      const { result, unmount } = renderHook(() =>
        useRemoteComponent('http://example.com/manifest.json', './Button', undefined, {
          hotReload: true,
        }),
      );

      await waitFor(() => expect(result.current.mount).toBe(mockMount));

      unmount();
      expect(stopWatching).toHaveBeenCalledOnce();
    });
  });
});
