import { describe, it, expect } from 'vitest';
import { withCacheBust } from '../src/chunk-loader';

describe('withCacheBust', () => {
  it('appends a query param to a URL with no existing query string', () => {
    const result = withCacheBust('/button.chunk.js');
    expect(result.startsWith('/button.chunk.js?')).toBe(true);
  });

  it('appends with & when the URL already has a query string', () => {
    const result = withCacheBust('/button.chunk.js?foo=bar');
    expect(result.startsWith('/button.chunk.js?foo=bar&')).toBe(true);
  });

  it('produces a different value on each call', () => {
    const first = withCacheBust('/button.chunk.js');
    const second = withCacheBust('/button.chunk.js');
    expect(first).not.toBe(second);
  });
});
