import { describe, it, expect, afterEach, vi } from 'vitest';
import { isDataSaverOrSlowConnection } from '../src/network-aware';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isDataSaverOrSlowConnection', () => {
  it('returns false when navigator.connection is unavailable', () => {
    expect(isDataSaverOrSlowConnection()).toBe(false);
  });

  it('returns true when saveData is enabled', () => {
    vi.stubGlobal('navigator', { connection: { saveData: true, effectiveType: '4g' } });
    expect(isDataSaverOrSlowConnection()).toBe(true);
  });

  it('returns true on a 2g connection', () => {
    vi.stubGlobal('navigator', { connection: { saveData: false, effectiveType: '2g' } });
    expect(isDataSaverOrSlowConnection()).toBe(true);
  });

  it('returns true on a slow-2g connection', () => {
    vi.stubGlobal('navigator', { connection: { saveData: false, effectiveType: 'slow-2g' } });
    expect(isDataSaverOrSlowConnection()).toBe(true);
  });

  it('returns false on a 4g connection with saveData off', () => {
    vi.stubGlobal('navigator', { connection: { saveData: false, effectiveType: '4g' } });
    expect(isDataSaverOrSlowConnection()).toBe(false);
  });

  it('returns false outside the browser', () => {
    vi.stubGlobal('navigator', undefined);
    expect(isDataSaverOrSlowConnection()).toBe(false);
  });
});
