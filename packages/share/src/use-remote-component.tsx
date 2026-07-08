'use client';
import { useState, useEffect } from 'react';
import { loadManifest } from './manifest-loader';
import { loadChunk } from './chunk-loader';
import { watchChunkForChanges } from './chunk-watcher';
import { checkVersion } from './version-check';
import { assertSharedDepsAvailable } from './shared-dep-guard';
import { resolveExposeChunkUrl } from './resolve-chunk-url';
import type { RemoteComponentState } from './types';

export interface UseRemoteComponentOptions {
  /** Poll the resolved chunk URL and swap in a rebuilt version without a page reload. Dev-only — opt in explicitly. */
  hotReload?: boolean;
  /** Poll interval in ms. Defaults to 2000. Only used when hotReload is true. */
  hotReloadInterval?: number;
}

export function useRemoteComponent(
  manifestUrl: string,
  exposeName: string,
  requiredVersion?: string,
  options?: UseRemoteComponentOptions,
): RemoteComponentState {
  const { hotReload = false, hotReloadInterval } = options ?? {};
  const [state, setState] = useState<RemoteComponentState>({
    mount: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    let stopWatching: (() => void) | undefined;

    setState({ mount: null, loading: true, error: null });

    loadManifest(manifestUrl)
      .then((manifest) => {
        if (cancelled) return null;

        const entry = manifest.exposes[exposeName];
        if (!entry) {
          throw new Error(
            `Expose "${exposeName}" not found in manifest "${manifest.name}"`,
          );
        }

        if (requiredVersion) checkVersion(entry.version, requiredVersion);

        assertSharedDepsAvailable(manifest.shared);

        const chunkUrl = resolveExposeChunkUrl(manifest, exposeName);

        return loadChunk(chunkUrl).then((mod) => ({ mod, chunkUrl }));
      })
      .then((result) => {
        if (cancelled || !result) return;
        const { mod, chunkUrl } = result;
        setState({ mount: mod.default, loading: false, error: null });

        if (hotReload) {
          stopWatching = watchChunkForChanges(
            chunkUrl,
            (newMod) => setState((s) => ({ ...s, mount: newMod.default })),
            { interval: hotReloadInterval ?? 2000 },
          );
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          mount: null,
          loading: false,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      });

    return () => {
      cancelled = true;
      stopWatching?.();
    };
  }, [manifestUrl, exposeName, requiredVersion, hotReload, hotReloadInterval]);

  return state;
}
