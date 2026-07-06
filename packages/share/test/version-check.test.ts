import { describe, it, expect } from 'vitest';
import { checkVersion, satisfiesCaretRange, parseSemVer } from '../src/version-check';

describe('checkVersion', () => {
  describe('exact match', () => {
    it('passes when versions are equal', () => {
      expect(() => checkVersion('1.2.3', '1.2.3')).not.toThrow();
    });

    it('throws when major differs', () => {
      expect(() => checkVersion('2.0.0', '1.0.0')).toThrow('Version mismatch');
    });

    it('throws when minor differs', () => {
      expect(() => checkVersion('1.3.0', '1.2.0')).toThrow('Version mismatch');
    });
  });

  describe('caret (^) constraint', () => {
    it('passes when same major and provided >= required', () => {
      expect(() => checkVersion('1.3.0', '^1.2.0')).not.toThrow();
      expect(() => checkVersion('1.2.1', '^1.2.0')).not.toThrow();
      expect(() => checkVersion('1.2.0', '^1.2.0')).not.toThrow();
    });

    it('throws when major differs', () => {
      expect(() => checkVersion('2.0.0', '^1.0.0')).toThrow('Version mismatch');
    });

    it('throws when provided minor is less than required', () => {
      expect(() => checkVersion('1.1.0', '^1.2.0')).toThrow('Version mismatch');
    });

    it('throws when provided patch is less than required (same minor)', () => {
      expect(() => checkVersion('1.2.0', '^1.2.3')).toThrow('Version mismatch');
    });
  });

  describe('tilde (~) constraint', () => {
    it('passes when same major.minor and provided patch >= required', () => {
      expect(() => checkVersion('1.2.5', '~1.2.3')).not.toThrow();
      expect(() => checkVersion('1.2.3', '~1.2.3')).not.toThrow();
    });

    it('throws when minor differs', () => {
      expect(() => checkVersion('1.3.0', '~1.2.0')).toThrow('Version mismatch');
    });

    it('throws when patch is less than required', () => {
      expect(() => checkVersion('1.2.2', '~1.2.3')).toThrow('Version mismatch');
    });
  });

  describe('pre-release version strings', () => {
    it('parses provided pre-release version without NaN', () => {
      // '1.0.0-alpha' should compare as 1.0.0 — no NaN from Number('0-alpha')
      expect(() => checkVersion('1.0.0-alpha', '1.0.0')).not.toThrow();
    });

    it('parses required pre-release version without NaN', () => {
      expect(() => checkVersion('1.0.0', '1.0.0-alpha')).not.toThrow();
    });

    it('passes caret constraint with pre-release provided', () => {
      expect(() => checkVersion('1.2.0-beta', '^1.0.0')).not.toThrow();
    });

    it('parses build metadata (+) correctly', () => {
      expect(() => checkVersion('1.0.0+build.42', '1.0.0')).not.toThrow();
    });
  });
});

describe('satisfiesCaretRange', () => {
  it('is true when major, minor, and patch all match', () => {
    expect(satisfiesCaretRange(parseSemVer('1.2.3'), parseSemVer('1.2.3'))).toBe(true);
  });

  it('is true when provided minor is greater, same major', () => {
    expect(satisfiesCaretRange(parseSemVer('1.3.0'), parseSemVer('1.2.0'))).toBe(true);
  });

  it('is true when provided patch is greater, same major.minor', () => {
    expect(satisfiesCaretRange(parseSemVer('1.2.5'), parseSemVer('1.2.3'))).toBe(true);
  });

  it('is false when provided patch is lower, same major.minor', () => {
    expect(satisfiesCaretRange(parseSemVer('1.2.2'), parseSemVer('1.2.3'))).toBe(false);
  });

  it('is false when provided minor is lower, same major', () => {
    expect(satisfiesCaretRange(parseSemVer('1.1.0'), parseSemVer('1.2.0'))).toBe(false);
  });

  it('is false when major differs, even if provided is numerically greater', () => {
    expect(satisfiesCaretRange(parseSemVer('2.0.0'), parseSemVer('1.9.9'))).toBe(false);
  });
});
