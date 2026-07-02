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

  it('passes when the live global exists and its version is compatible', () => {
    window.__bridgeShared = { react: { version: '18.3.1' } };
    expect(() =>
      assertSharedDepsAvailable({ react: { version: '18.3.0', external: true } }),
    ).not.toThrow();
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
