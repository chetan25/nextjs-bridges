'use client';
import { useState, useEffect } from 'react';
import { loadManifest } from './manifest-loader';
import { loadChunk } from './chunk-loader';
import { checkVersion } from './version-check';
import { assertSharedDepsAvailable } from './shared-dep-guard';
import type { RemoteComponentState } from './types';

export function useRemoteComponent(
  manifestUrl: string,
  exposeName: string,
  requiredVersion?: string,
): RemoteComponentState {
  const [state, setState] = useState<RemoteComponentState>({
    mount: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

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

        const chunkUrl = entry.chunk.startsWith('http')
          ? entry.chunk
          : `${manifest.baseUrl}${entry.chunk}`;

        return loadChunk(chunkUrl);
      })
      .then((mod) => {
        if (cancelled || !mod) return;
        setState({ mount: mod.default, loading: false, error: null });
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
    };
  }, [manifestUrl, exposeName, requiredVersion]);

  return state;
}
