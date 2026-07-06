import { loadChunk, type ChunkModule } from './chunk-loader';

// Cheap, non-cryptographic hash — only used to detect "did the bytes change",
// never for security or collision-resistance.
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Polls `url` on an interval, hashing the raw response body to detect when a
 * host rebuild has changed a chunk's content — even though the chunk's URL
 * itself never changes (stable filenames + the browser's permanent ES module
 * cache mean a plain re-`import()` of the same URL would otherwise never see
 * the update).
 *
 * The first poll only establishes a baseline hash; `onChange` never fires for
 * it. Network errors on any poll are swallowed and retried next tick — this
 * mechanism can only improve an already-working mount, never break it.
 *
 * Returns a `stop()` function that cancels further polling.
 */
export function watchChunkForChanges(
  url: string,
  onChange: (mod: ChunkModule) => void,
  options?: { interval?: number },
): () => void {
  const interval = options?.interval ?? 2000;
  let lastHash: string | null = null;
  let stopped = false;

  const tick = async () => {
    try {
      const text = await fetch(url, { cache: 'no-store' }).then((r) => r.text());
      const hash = fnv1a(text);
      if (lastHash === null) {
        lastHash = hash;
        return;
      }
      if (hash === lastHash) return;
      lastHash = hash;
      const mod = await loadChunk(url, { cacheBust: true });
      if (!stopped) onChange(mod);
    } catch {
      // Transient network blip or rebuild-in-progress 404 — retry next tick.
    }
  };

  const id = setInterval(tick, interval);
  return () => {
    stopped = true;
    clearInterval(id);
  };
}
