import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadManifest, bustManifestCache } from '../src/manifest-loader';
import type { ShareManifest } from '../src/types';

const MANIFEST_URL = 'http://example.com/share-manifest.json';

const validManifest: ShareManifest = {
  name: 'host-app',
  version: '1.0.0',
  baseUrl: 'http://localhost:3001',
  exposes: {
    './Button': { chunk: '/button.chunk.js', version: '1.0.0' },
  },
};

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) } as Response;
}

function errorResponse(status: number) {
  return { ok: false, status, json: () => Promise.resolve({}) } as Response;
}

describe('loadManifest', () => {
  const fetchSpy = vi.fn<typeof fetch>();

  beforeEach(() => {
    bustManifestCache();
    vi.stubGlobal('fetch', fetchSpy);
    fetchSpy.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches and returns a validated manifest', async () => {
    fetchSpy.mockResolvedValueOnce(okResponse(validManifest));
    const manifest = await loadManifest(MANIFEST_URL);
    expect(manifest).toEqual(validManifest);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('caches: two calls to the same URL share one fetch', async () => {
    fetchSpy.mockResolvedValue(okResponse(validManifest));
    const p1 = loadManifest(MANIFEST_URL);
    const p2 = loadManifest(MANIFEST_URL);
    expect(p1).toBe(p2);
    await p1;
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('different URLs get separate fetches', async () => {
    fetchSpy.mockResolvedValue(okResponse(validManifest));
    await Promise.all([
      loadManifest(MANIFEST_URL),
      loadManifest('http://other.com/manifest.json'),
    ]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('throws on non-ok HTTP response', async () => {
    fetchSpy.mockResolvedValueOnce(errorResponse(404));
    await expect(loadManifest(MANIFEST_URL)).rejects.toThrow('Manifest fetch failed (404)');
  });

  it('throws on invalid manifest — not an object', async () => {
    fetchSpy.mockResolvedValueOnce(okResponse('not-an-object'));
    await expect(loadManifest(MANIFEST_URL)).rejects.toThrow('Invalid manifest: not an object');
  });

  it('throws on invalid manifest — missing name', async () => {
    fetchSpy.mockResolvedValueOnce(okResponse({ version: '1.0.0', baseUrl: '', exposes: {} }));
    await expect(loadManifest(MANIFEST_URL)).rejects.toThrow('Invalid manifest: missing name');
  });

  it('throws on invalid manifest — missing baseUrl', async () => {
    fetchSpy.mockResolvedValueOnce(okResponse({ name: 'x', version: '1.0.0', exposes: {} }));
    await expect(loadManifest(MANIFEST_URL)).rejects.toThrow('Invalid manifest: missing baseUrl');
  });

  it('busts specific URL and forces re-fetch', async () => {
    fetchSpy.mockResolvedValue(okResponse(validManifest));
    await loadManifest(MANIFEST_URL);
    bustManifestCache(MANIFEST_URL);
    await loadManifest(MANIFEST_URL);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('bustManifestCache() with no arg clears all entries', async () => {
    fetchSpy.mockResolvedValue(okResponse(validManifest));
    await loadManifest(MANIFEST_URL);
    bustManifestCache();
    await loadManifest(MANIFEST_URL);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('failed fetch is not cached — next call retries', async () => {
    fetchSpy
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(okResponse(validManifest));

    // First call fails (retries = 1 so no internal retry, just throws)
    await expect(loadManifest(MANIFEST_URL, undefined, 1)).rejects.toThrow('Network error');
    // Second call should succeed (cache was cleared on failure)
    const manifest = await loadManifest(MANIFEST_URL, undefined, 1);
    expect(manifest.name).toBe('host-app');
  });

  it('retries on network failure before succeeding', async () => {
    vi.useFakeTimers();
    fetchSpy
      .mockRejectedValueOnce(new Error('Flaky network'))
      .mockResolvedValueOnce(okResponse(validManifest));

    const p = loadManifest(MANIFEST_URL, undefined, 2);
    await vi.runAllTimersAsync();
    const manifest = await p;
    expect(manifest.name).toBe('host-app');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
