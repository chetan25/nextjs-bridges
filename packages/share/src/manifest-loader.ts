import type { ShareManifest } from './types';

const MANIFEST_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  promise: Promise<ShareManifest>;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

function validateManifest(raw: unknown): ShareManifest {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid manifest: not an object');
  const m = raw as Record<string, unknown>;
  if (typeof m.name !== 'string') throw new Error('Invalid manifest: missing name');
  if (typeof m.version !== 'string') throw new Error('Invalid manifest: missing version');
  if (typeof m.baseUrl !== 'string') throw new Error('Invalid manifest: missing baseUrl');
  if (!m.exposes || typeof m.exposes !== 'object') throw new Error('Invalid manifest: missing exposes');
  return m as unknown as ShareManifest;
}

async function fetchWithRetry(
  url: string,
  retries: number,
  signal?: AbortSignal,
  delayFn: (ms: number) => Promise<void> = (ms) => new Promise<void>((r) => setTimeout(r, ms)),
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url, signal !== undefined ? { signal } : {});
    } catch (err) {
      if (i === retries - 1 || signal?.aborted) throw err;
      await delayFn(200 * 2 ** i);
    }
  }
  throw new Error('unreachable');
}

export function loadManifest(url: string, signal?: AbortSignal, retries = 3): Promise<ShareManifest> {
  const entry = cache.get(url);
  if (entry && Date.now() - entry.fetchedAt < MANIFEST_TTL_MS) return entry.promise;

  const promise = fetchWithRetry(url, retries, signal)
    .then((r) => {
      if (!r.ok) throw new Error(`Manifest fetch failed (${r.status}): ${url}`);
      return r.json() as Promise<unknown>;
    })
    .then(validateManifest)
    .catch((err: unknown) => {
      // Don't cache failures so the next caller gets a fresh attempt.
      cache.delete(url);
      throw err;
    });

  cache.set(url, { promise, fetchedAt: Date.now() });
  return promise;
}

export function bustManifestCache(url?: string): void {
  if (url !== undefined) {
    cache.delete(url);
  } else {
    cache.clear();
  }
}

// Exposed for testing the retry delay without real timers.
export { fetchWithRetry as _fetchWithRetry };
