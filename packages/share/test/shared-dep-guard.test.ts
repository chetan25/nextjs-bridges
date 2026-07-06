import { describe, it, expect, beforeEach } from 'vitest';
import { assertSharedDepsAvailable } from '../src/shared-dep-guard';

declare global {
  interface Window {
    __bridgeShared?: Record<string, unknown>;
  }
}

describe('assertSharedDepsAvailable', () => {
  beforeEach(() => {
    window.__bridgeShared = undefined;
  });

  it('does nothing when shared is undefined', () => {
    expect(() => assertSharedDepsAvailable(undefined)).not.toThrow();
  });

  it('does nothing for deps not marked external', () => {
    expect(() =>
      assertSharedDepsAvailable({ react: { version: '18.3.0', external: false } }),
    ).not.toThrow();
  });

  it('passes when the live global exists and its version is compatible with a caret range', () => {
    window.__bridgeShared = { react: { version: '18.3.1' } };
    expect(() =>
      assertSharedDepsAvailable({ react: { version: '^18.3.0', external: true } }),
    ).not.toThrow();
  });

  it('always applies caret-range semantics to entry.version, regardless of its own prefix', () => {
    // entry.version reflects the host's own declared version, which may or
    // may not carry a leading caret depending on how the host's package.json
    // happened to pin it — that incidental detail must not change strictness.
    // A live version with a higher (safe, semver-compatible) patch always passes.
    window.__bridgeShared = { react: { version: '18.3.5' } };
    expect(() =>
      assertSharedDepsAvailable({ react: { version: '18.3.0', external: true } }),
    ).not.toThrow();

    window.__bridgeShared = { react: { version: '18.3.0' } };
    expect(() =>
      assertSharedDepsAvailable({ react: { version: '18.3.0', external: true } }),
    ).not.toThrow();
  });

  it('throws when the live version has a lower patch than entry.version requires', () => {
    window.__bridgeShared = { react: { version: '18.3.0' } };
    expect(() =>
      assertSharedDepsAvailable({ react: { version: '18.3.5', external: true } }),
    ).toThrow('Version mismatch');
  });

  it('throws when the global is missing entirely', () => {
    expect(() =>
      assertSharedDepsAvailable({ react: { version: '18.3.0', external: true } }),
    ).toThrow('window.__bridgeShared.react');
  });

  it('throws when the live version has drifted to an incompatible major', () => {
    window.__bridgeShared = { react: { version: '19.0.0' } };
    expect(() =>
      assertSharedDepsAvailable({ react: { version: '18.3.0', external: true } }),
    ).toThrow('Version mismatch');
  });

  it('throws when the live global has no version property', () => {
    window.__bridgeShared = { react: {} };
    expect(() =>
      assertSharedDepsAvailable({ react: { version: '18.3.0', external: true } }),
    ).toThrow('no version to verify compatibility');
  });
});
