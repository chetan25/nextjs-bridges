export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

export function parseSemVer(raw: string): SemVer {
  // Strip leading non-digit prefix (^, ~, v) and pre-release/build metadata
  // so strings like "1.0.0-alpha" or "1.0.0+build" parse correctly.
  // Without the pre-release strip, Number('0-alpha') returns NaN.
  const clean = raw.replace(/^[^\d]*/, '').replace(/[-+].*$/, '');
  const [major = 0, minor = 0, patch = 0] = clean.split('.').map(Number);
  return { major, minor, patch };
}

/**
 * Throws if `provided` does not satisfy `required`.
 * Supports exact, ^major, and ~major.minor constraints.
 */
export function checkVersion(provided: string, required: string): void {
  const caret = required.startsWith('^');
  const tilde = required.startsWith('~');
  const clean = required.replace(/^[\^~]/, '');

  const p = parseSemVer(provided);
  const r = parseSemVer(clean);

  let ok: boolean;
  if (caret) {
    // ^1.2.3 → >=1.2.3 <2.0.0
    ok =
      p.major === r.major &&
      (p.minor > r.minor || (p.minor === r.minor && p.patch >= r.patch));
  } else if (tilde) {
    // ~1.2.3 → >=1.2.3 <1.3.0
    ok = p.major === r.major && p.minor === r.minor && p.patch >= r.patch;
  } else {
    // exact
    ok = p.major === r.major && p.minor === r.minor && p.patch === r.patch;
  }

  if (!ok) {
    throw new Error(
      `Version mismatch: remote provides "${provided}" but consumer requires "${required}"`,
    );
  }
}
