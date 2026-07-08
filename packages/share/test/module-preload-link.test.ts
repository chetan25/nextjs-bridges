import { describe, it, expect, afterEach, vi } from 'vitest';
import { injectModulePreloadLink } from '../src/module-preload-link';

afterEach(() => {
  vi.unstubAllGlobals();
  document.head.querySelectorAll('link[rel="modulepreload"]').forEach((el) => el.remove());
});

describe('injectModulePreloadLink', () => {
  it('appends a link[rel=modulepreload] with the given href', () => {
    injectModulePreloadLink('http://localhost:3001/button.chunk.js');

    const link = document.head.querySelector('link[rel="modulepreload"]');
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute('href', 'http://localhost:3001/button.chunk.js');
  });

  it('sets fetchpriority when provided', () => {
    injectModulePreloadLink('http://localhost:3001/button.chunk.js', 'high');

    const link = document.head.querySelector('link[rel="modulepreload"]');
    expect(link).toHaveAttribute('fetchpriority', 'high');
  });

  it('omits fetchpriority when not provided', () => {
    injectModulePreloadLink('http://localhost:3001/button.chunk.js');

    const link = document.head.querySelector('link[rel="modulepreload"]');
    expect(link).not.toHaveAttribute('fetchpriority');
  });

  it('does not add a duplicate link for the same URL', () => {
    injectModulePreloadLink('http://localhost:3001/button.chunk.js');
    injectModulePreloadLink('http://localhost:3001/button.chunk.js');

    const links = document.head.querySelectorAll('link[rel="modulepreload"]');
    expect(links).toHaveLength(1);
  });

  it('adds separate links for different URLs', () => {
    injectModulePreloadLink('http://localhost:3001/button.chunk.js');
    injectModulePreloadLink('http://localhost:3001/cart.chunk.js');

    const links = document.head.querySelectorAll('link[rel="modulepreload"]');
    expect(links).toHaveLength(2);
  });

  it('does nothing outside the browser', () => {
    vi.stubGlobal('document', undefined);
    expect(() => injectModulePreloadLink('http://localhost:3001/button.chunk.js')).not.toThrow();
  });
});
