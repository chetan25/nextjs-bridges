import { describe, it, expect } from 'vitest';
import { resolveExposeChunkUrl } from '../src/resolve-chunk-url';
import type { ShareManifest } from '../src/types';

const manifest: ShareManifest = {
  name: 'host-app',
  version: '1.0.0',
  baseUrl: 'http://localhost:3001',
  exposes: {
    './Button': { chunk: '/button.chunk.js', version: '1.0.0' },
    './External': { chunk: 'https://cdn.example.com/external.chunk.js', version: '1.0.0' },
  },
};

describe('resolveExposeChunkUrl', () => {
  it('builds an absolute URL from baseUrl + a relative chunk path', () => {
    expect(resolveExposeChunkUrl(manifest, './Button')).toBe(
      'http://localhost:3001/button.chunk.js',
    );
  });

  it('uses the chunk URL directly when it already starts with http', () => {
    expect(resolveExposeChunkUrl(manifest, './External')).toBe(
      'https://cdn.example.com/external.chunk.js',
    );
  });

  it('throws when the expose is not found in the manifest', () => {
    expect(() => resolveExposeChunkUrl(manifest, './Missing')).toThrow(
      '"./Missing" not found in manifest "host-app"',
    );
  });
});
