import { describe, it, expect } from 'vitest';
import { resolveSharedDeps } from '../src/shared-dep-resolver';

describe('resolveSharedDeps', () => {
  it('externalizes when own version exactly matches the contract', () => {
    const result = resolveSharedDeps(
      { react: {} },
      { react: '18.3.0' },
      { react: '18.3.0' },
    );
    expect(result.react).toEqual({ external: true, ownVersion: '18.3.0', contractVersion: '18.3.0' });
  });

  it('externalizes when own minor is lower than the contract, same major', () => {
    const result = resolveSharedDeps({ react: {} }, { react: '18.2.0' }, { react: '18.3.0' });
    expect(result.react.external).toBe(true);
  });

  it('does not externalize when own minor is higher than the contract', () => {
    const result = resolveSharedDeps({ react: {} }, { react: '18.4.0' }, { react: '18.3.0' });
    expect(result.react.external).toBe(false);
  });

  it('does not externalize when major differs', () => {
    const result = resolveSharedDeps({ react: {} }, { react: '17.0.0' }, { react: '18.3.0' });
    expect(result.react.external).toBe(false);
  });

  it('strips ^ and ~ prefixes from both own and contract versions', () => {
    const result = resolveSharedDeps({ react: {} }, { react: '^18.2.0' }, { react: '~18.3.0' });
    expect(result.react.external).toBe(true);
  });

  it('does not externalize when own version is missing', () => {
    const result = resolveSharedDeps({ react: {} }, {}, { react: '18.3.0' });
    expect(result.react).toEqual({ external: false, ownVersion: 'unknown' });
  });

  it('does not externalize when the contract has no entry for the dep', () => {
    const result = resolveSharedDeps({ react: {} }, { react: '18.3.0' }, {});
    expect(result.react).toEqual({ external: false, ownVersion: '18.3.0' });
  });

  it('resolves each shared dep independently', () => {
    const result = resolveSharedDeps(
      { react: {}, 'react-dom': {} },
      { react: '18.3.0', 'react-dom': '17.0.0' },
      { react: '18.3.0', 'react-dom': '18.3.0' },
    );
    expect(result.react.external).toBe(true);
    expect(result['react-dom'].external).toBe(false);
  });
});
