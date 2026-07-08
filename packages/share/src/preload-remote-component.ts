import { loadManifest } from './manifest-loader';
import { loadChunk } from './chunk-loader';
import { resolveExposeChunkUrl } from './resolve-chunk-url';
import { injectModulePreloadLink, type FetchPriority } from './module-preload-link';
import { isDataSaverOrSlowConnection } from './network-aware';

export interface PreloadRemoteComponentOptions {
  /** Sets `fetchpriority` on the injected `<link rel="modulepreload">` for the chunk. */
  fetchPriority?: FetchPriority;
  /**
   * Skip this preload on Save-Data or a slow (2g/slow-2g) connection, so a
   * speculative preload doesn't compete with whatever's actually on the
   * critical path. Default `true`. This only affects `preloadRemoteComponent`
   * itself — it has no effect on `useRemoteComponent`/`<RemoteComponent>`,
   * which always load when they actually need to mount.
   */
  respectConnection?: boolean;
}

/**
 * Warms the manifest and chunk caches for an expose ahead of when
 * `<RemoteComponent>`/`useRemoteComponent` actually need them, so the real
 * mount resolves from cache instead of paying the manifest -> chunk waterfall
 * at render time. Both `loadManifest` and `loadChunk` are already cached by
 * URL, so this is exactly the same work the real mount would do, just done
 * early. It also injects a `<link rel="modulepreload">` for the resolved
 * chunk URL, handing the fetch to the browser's own module preloader rather
 * than relying solely on `import()`'s timing.
 *
 * Fire-and-forget from a hover/focus handler, or an effect for an
 * above-the-fold widget you know you'll render. Rejects on the same failures
 * `useRemoteComponent` would (missing expose, network failure) — call sites
 * that don't care can leave the returned promise unhandled; call sites that
 * want to log a failed preload can `.catch()` it. Resolves immediately,
 * without fetching anything, when skipped due to `respectConnection`.
 */
export async function preloadRemoteComponent(
  manifestUrl: string,
  exposeName: string,
  options?: PreloadRemoteComponentOptions,
): Promise<void> {
  const respectConnection = options?.respectConnection ?? true;
  if (respectConnection && isDataSaverOrSlowConnection()) return;

  const manifest = await loadManifest(manifestUrl);
  const chunkUrl = resolveExposeChunkUrl(manifest, exposeName);
  injectModulePreloadLink(chunkUrl, options?.fetchPriority);
  await loadChunk(chunkUrl);
}
