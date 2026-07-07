'use client';
import { createElement } from 'react';
import { useRemoteComponent } from './use-remote-component';
import type { UseRemoteComponentOptions } from './use-remote-component';
import { RemoteComponent } from './remote-component';
import type { RemoteComponentProps } from './remote-component';
import type { RemoteComponentState } from './types';

export interface RemoteRegistry {
  /** Same as the top-level `useRemoteComponent`, with `manifestUrl` already bound. */
  useRemoteComponent(
    exposeName: string,
    requiredVersion?: string,
    options?: UseRemoteComponentOptions,
  ): RemoteComponentState;
  /** Same as the top-level `<RemoteComponent>`, with `manifestUrl` already bound. */
  RemoteComponent(props: Omit<RemoteComponentProps, 'manifestUrl'>): ReturnType<typeof RemoteComponent>;
}

/**
 * Binds a manifest URL (and optional default options) once, so call sites
 * reference exposes by name instead of repeating the manifest URL string
 * everywhere — the common case for an app that consumes many exposes from
 * the same host.
 */
export function createRemoteRegistry(
  manifestUrl: string,
  defaultOptions?: UseRemoteComponentOptions,
): RemoteRegistry {
  return {
    useRemoteComponent(exposeName, requiredVersion, options) {
      return useRemoteComponent(manifestUrl, exposeName, requiredVersion, {
        ...defaultOptions,
        ...options,
      });
    },
    RemoteComponent(props) {
      return createElement(RemoteComponent, { manifestUrl, ...props });
    },
  };
}
