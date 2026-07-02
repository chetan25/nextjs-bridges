export interface ShareManifestEntry {
  chunk: string;
  version: string;
}

export interface ShareManifest {
  name: string;
  version: string;
  baseUrl: string;
  exposes: Record<string, ShareManifestEntry>;
  shared?: Record<string, { version: string; singleton?: boolean; external?: boolean }>;
}

/**
 * The function exported as `default` from a remote chunk.
 * It mounts the remote component into `container` with `props` and returns
 * a cleanup function that unmounts it. Each app manages its own React root,
 * so there is no dual-React-instance problem.
 */
export type MountFunction = (
  container: HTMLElement,
  props: Record<string, unknown>,
) => () => void;

export interface RemoteComponentState {
  mount: MountFunction | null;
  loading: boolean;
  error: Error | null;
}

export interface ShareConfig {
  name: string;
  version?: string;
  baseUrl?: string;
  exposes: Record<string, string>;
  shared?: Record<string, { singleton?: boolean }>;
}

