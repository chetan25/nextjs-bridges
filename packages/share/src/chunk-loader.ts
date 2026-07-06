import type { MountFunction } from './types';

export interface ChunkModule {
  default: MountFunction;
}

/**
 * Appends a unique query param to a chunk URL, forcing the browser to treat it
 * as a new module specifier — bypassing the ES module cache that otherwise
 * keeps returning the same instance forever for a given URL.
 */
export function withCacheBust(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}_hotReload=${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Dynamically loads a pre-built JS chunk from a remote URL.
 *
 * The chunk must export a `mount(container, props) → unmount` function as its
 * default export. This keeps each remote app's React isolated in its own root
 * so the consumer never sees React elements created by a different React instance.
 *
 * The `turbopackIgnore` pragma suppresses Turbopack's static-analysis warning for
 * runtime-string dynamic imports.
 *
 * Pass `{ cacheBust: true }` to force a fresh fetch + re-evaluation of the same
 * URL (used by hot-reload, where the chunk's stable filename never changes).
 */
export function loadChunk(url: string, options?: { cacheBust?: boolean }): Promise<ChunkModule> {
  const target = options?.cacheBust ? withCacheBust(url) : url;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — intentional runtime-string dynamic import, analysed by turbopackIgnore
  return import(/* turbopackIgnore: true */ target) as Promise<ChunkModule>;
}
