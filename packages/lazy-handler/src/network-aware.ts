interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
}

/**
 * `navigator.connection` is non-standard (Chromium-only; unsupported in
 * Firefox/Safari) — where it's unavailable this always returns `false`, so
 * behavior is unchanged in those browsers.
 */
export function isDataSaverOrSlowConnection(): boolean {
  if (typeof navigator === 'undefined') return false;
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  if (!connection) return false;
  if (connection.saveData) return true;
  return connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g';
}
