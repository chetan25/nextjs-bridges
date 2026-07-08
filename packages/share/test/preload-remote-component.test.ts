import { describe, it, expect, vi, beforeEach } from 'vitest';
import { preloadRemoteComponent } from '../src/preload-remote-component';

vi.mock('../src/manifest-loader', () => ({
  loadManifest: vi.fn(),
}));

vi.mock('../src/chunk-loader', () => ({
  loadChunk: vi.fn(),
}));

vi.mock('../src/module-preload-link', () => ({
  injectModulePreloadLink: vi.fn(),
}));

vi.mock('../src/network-aware', () => ({
  isDataSaverOrSlowConnection: vi.fn(() => false),
}));

import { loadManifest } from '../src/manifest-loader';
import { loadChunk } from '../src/chunk-loader';
import { injectModulePreloadLink } from '../src/module-preload-link';
import { isDataSaverOrSlowConnection } from '../src/network-aware';

const mockManifest = {
  name: 'host-app',
  version: '1.0.0',
  baseUrl: 'http://localhost:3001',
  exposes: {
    './Button': { chunk: '/button.chunk.js', version: '1.0.0' },
  },
};

function mockMount() {
  return () => {};
}

describe('preloadRemoteComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isDataSaverOrSlowConnection).mockReturnValue(false);
  });

  it('warms both the manifest and chunk caches for the given expose', async () => {
    vi.mocked(loadManifest).mockResolvedValue(mockManifest);
    vi.mocked(loadChunk).mockResolvedValue({ default: mockMount });

    await preloadRemoteComponent('http://example.com/manifest.json', './Button');

    expect(loadManifest).toHaveBeenCalledWith('http://example.com/manifest.json');
    expect(loadChunk).toHaveBeenCalledWith('http://localhost:3001/button.chunk.js');
  });

  it('injects a modulepreload link for the resolved chunk URL', async () => {
    vi.mocked(loadManifest).mockResolvedValue(mockManifest);
    vi.mocked(loadChunk).mockResolvedValue({ default: mockMount });

    await preloadRemoteComponent('http://example.com/manifest.json', './Button');

    expect(injectModulePreloadLink).toHaveBeenCalledWith(
      'http://localhost:3001/button.chunk.js',
      undefined,
    );
  });

  it('forwards fetchPriority to the injected modulepreload link', async () => {
    vi.mocked(loadManifest).mockResolvedValue(mockManifest);
    vi.mocked(loadChunk).mockResolvedValue({ default: mockMount });

    await preloadRemoteComponent('http://example.com/manifest.json', './Button', {
      fetchPriority: 'high',
    });

    expect(injectModulePreloadLink).toHaveBeenCalledWith(
      'http://localhost:3001/button.chunk.js',
      'high',
    );
  });

  it('skips the preload entirely on a constrained connection', async () => {
    vi.mocked(isDataSaverOrSlowConnection).mockReturnValue(true);
    vi.mocked(loadManifest).mockResolvedValue(mockManifest);
    vi.mocked(loadChunk).mockResolvedValue({ default: mockMount });

    await preloadRemoteComponent('http://example.com/manifest.json', './Button');

    expect(loadManifest).not.toHaveBeenCalled();
    expect(loadChunk).not.toHaveBeenCalled();
    expect(injectModulePreloadLink).not.toHaveBeenCalled();
  });

  it('respectConnection=false preloads even on a constrained connection', async () => {
    vi.mocked(isDataSaverOrSlowConnection).mockReturnValue(true);
    vi.mocked(loadManifest).mockResolvedValue(mockManifest);
    vi.mocked(loadChunk).mockResolvedValue({ default: mockMount });

    await preloadRemoteComponent('http://example.com/manifest.json', './Button', {
      respectConnection: false,
    });

    expect(loadManifest).toHaveBeenCalled();
    expect(loadChunk).toHaveBeenCalled();
  });

  it('rejects when the expose is not found in the manifest', async () => {
    vi.mocked(loadManifest).mockResolvedValue(mockManifest);

    await expect(
      preloadRemoteComponent('http://example.com/manifest.json', './Missing'),
    ).rejects.toThrow('"./Missing" not found');
    expect(loadChunk).not.toHaveBeenCalled();
  });

  it('rejects when the manifest fetch fails', async () => {
    vi.mocked(loadManifest).mockRejectedValue(new Error('network error'));

    await expect(
      preloadRemoteComponent('http://example.com/manifest.json', './Button'),
    ).rejects.toThrow('network error');
    expect(loadChunk).not.toHaveBeenCalled();
  });

  it('rejects when the chunk fetch fails', async () => {
    vi.mocked(loadManifest).mockResolvedValue(mockManifest);
    vi.mocked(loadChunk).mockRejectedValue(new Error('chunk 404'));

    await expect(
      preloadRemoteComponent('http://example.com/manifest.json', './Button'),
    ).rejects.toThrow('chunk 404');
  });
});
