export interface SharedDepDecision {
  external: boolean;
  ownVersion: string;
  contractVersion?: string;
}

interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

function parseVersion(raw: string): SemVer {
  const clean = raw.replace(/^[\^~]/, '').replace(/[-+].*$/, '');
  const [major = 0, minor = 0, patch = 0] = clean.split('.').map(Number);
  return { major, minor, patch };
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

    const own = parseVersion(ownRaw);
    const provided = parseVersion(contractRaw);
    const external = own.major === provided.major && own.minor <= provided.minor;

    result[dep] = { external, ownVersion: ownRaw, contractVersion: contractRaw };
  }

  return result;
}
