import { readFileSync } from 'fs';
import { parseSemVer, satisfiesCaretRange } from './version-check';

export interface SharedDepDecision {
  external: boolean;
  ownVersion: string;
  contractVersion?: string;
}

/**
 * Decides, per shared dependency, whether apps/host's own version is
 * compatible enough with what apps/web guarantees to skip bundling it.
 * Compatible means: same major, and the contract version satisfies own
 * version down to patch (satisfiesCaretRange) — apps/web's copy is what
 * actually runs, so it must be at least as new as what the exposed
 * component was built against.
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
    const external = satisfiesCaretRange(provided, own);

    result[dep] = { external, ownVersion: ownRaw, contractVersion: contractRaw };
  }

  return result;
}

export function readContract(contractPath: string): Record<string, string> {
  try {
    const raw = JSON.parse(readFileSync(contractPath, 'utf-8'));
    return raw && typeof raw === 'object' ? (raw as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function loadSharedDepDecisions(
  shared: Record<string, { singleton?: boolean }>,
  ownVersions: Record<string, string>,
  contractPath: string,
): Record<string, SharedDepDecision> {
  return resolveSharedDeps(shared, ownVersions, readContract(contractPath));
}

/**
 * Reads each shared dependency's version out of a package.json's
 * `dependencies` field. Shared by generateShareManifest() (Task 6) and
 * apps/host/tsup.config.ts (Task 10) so neither duplicates this glue.
 */
export function loadOwnVersions(
  shared: Record<string, unknown>,
  ownPackageJsonPath: string,
): Record<string, string> {
  const ownPkg = JSON.parse(readFileSync(ownPackageJsonPath, 'utf-8')) as {
    dependencies?: Record<string, string>;
  };
  return Object.fromEntries(
    Object.keys(shared).map((dep) => [dep, ownPkg.dependencies?.[dep] ?? '0.0.0']),
  );
}
