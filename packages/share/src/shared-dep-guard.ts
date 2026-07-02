import { checkVersion } from './version-check';
import type { ShareManifest } from './types';

declare global {
  interface Window {
    __bridgeShared?: Record<string, unknown>;
  }
}

/**
 * Re-verifies, at mount time, that the shell's live shared dependencies still
 * satisfy what an externalized chunk's manifest recorded at build time. The
 * build-time decision (shared-dep-resolver.ts) is a snapshot — this guard is
 * what catches the shell having since upgraded to an incompatible version.
 * An externalized chunk has no bundled fallback, so a failure here is always
 * a hard error, surfaced through RemoteErrorBoundary — never a silent skip.
 */
export function assertSharedDepsAvailable(shared: ShareManifest['shared']): void {
  if (!shared) return;

  for (const [dep, entry] of Object.entries(shared)) {
    if (!entry.external) continue;

    const live = window.__bridgeShared?.[dep] as { version?: unknown } | undefined;
    if (!live) {
      throw new Error(
        `@bridge/share: shared dependency "${dep}" was expected at window.__bridgeShared.${dep} but is not available. ` +
          'Make sure <BridgeSharedDepsProvider> wraps this page before any remote component mounts.',
      );
    }

    if (typeof live.version !== 'string') {
      throw new Error(
        `@bridge/share: shared dependency "${dep}" is available but has no version to verify compatibility.`,
      );
    }

    checkVersion(live.version, entry.version);
  }
}
