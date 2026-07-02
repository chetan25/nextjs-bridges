import { parseSemVer } from './version-check';

export interface SharedDepDecision {
  external: boolean;
  ownVersion: string;
  contractVersion?: string;
}

/**
 * Decides, per shared dependency, whether apps/host's own version is
 * compatible enough with what apps/web guarantees to skip bundling it.
 * Compatible means: same major, and own minor <= contract minor — apps/web's
 * copy is what actually runs, so it must be at least as new as what the
 * exposed component was built against.
 */
export function resolveSharedDeps(
  shared: Record<string, { singleton?: boolean }>,
  ownVersions: Record<string, string>,
  contract: Record<string, string>,
): Record<string, SharedDepDecision> {
  const result: Record<string, SharedDepDecision> = {};

  for (const dep of Object.keys(shared)) {
    const ownRaw = ownVersions[dep];
    if (!ownRaw) {
      result[dep] = { external: false, ownVersion: 'unknown' };
      continue;
    }

    const contractRaw = contract[dep];
    if (!contractRaw) {
      result[dep] = { external: false, ownVersion: ownRaw };
      continue;
    }

    const own = parseSemVer(ownRaw);
    const provided = parseSemVer(contractRaw);
    const external = own.major === provided.major && own.minor <= provided.minor;

    result[dep] = { external, ownVersion: ownRaw, contractVersion: contractRaw };
  }

  return result;
}
