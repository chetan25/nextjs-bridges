import type { ShareManifest } from './types';

/**
 * Looks up `exposeName` in `manifest` and builds its absolute chunk URL.
 * Shared by `useRemoteComponent` and `preloadRemoteComponent` so both resolve
 * a chunk URL from a manifest the exact same way.
 */
export function resolveExposeChunkUrl(manifest: ShareManifest, exposeName: string): string {
  const entry = manifest.exposes[exposeName];
  if (!entry) {
    throw new Error(`Expose "${exposeName}" not found in manifest "${manifest.name}"`);
  }
  return entry.chunk.startsWith('http') ? entry.chunk : `${manifest.baseUrl}${entry.chunk}`;
}
