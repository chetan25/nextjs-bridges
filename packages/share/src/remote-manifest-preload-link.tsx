import type { FetchPriority } from './module-preload-link';

export interface RemoteManifestPreloadLinkProps {
  manifestUrl: string;
  /** Sets `fetchpriority` on the rendered `<link>`. */
  fetchPriority?: FetchPriority;
}

/**
 * Renders a `<link rel="preload">` for a share manifest URL. Render this in a
 * layout or other server-rendered ancestor (it has no client-only behavior,
 * so Next.js includes it in the initial server-rendered HTML) so the
 * browser's preload scanner discovers and starts fetching the manifest while
 * parsing HTML — before any React code runs, and well before
 * `<RemoteComponent>`/`useRemoteComponent` would otherwise trigger the fetch.
 *
 * This only warms the manifest fetch (the waterfall's first hop). The chunk
 * URL isn't known until the manifest resolves, so warming the chunk itself
 * still needs `preloadRemoteComponent` once you know which expose you want.
 */
export function RemoteManifestPreloadLink({
  manifestUrl,
  fetchPriority,
}: RemoteManifestPreloadLinkProps) {
  // Passed as the raw lowercase attribute (not the `fetchPriority` JSX prop) —
  // this React version's DOM prop whitelist doesn't recognize the camelCase
  // form yet and warns about it, even though browsers accept either casing.
  const fetchPriorityAttr = fetchPriority ? { fetchpriority: fetchPriority } : {};
  return (
    <link
      rel="preload"
      as="fetch"
      crossOrigin="anonymous"
      href={manifestUrl}
      {...fetchPriorityAttr}
    />
  );
}
