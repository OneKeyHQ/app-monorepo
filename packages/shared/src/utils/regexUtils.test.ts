import {
  escapeRegex,
  matchAll,
  replaceAll,
  testRegex,
} from './regexUtils';

describe('regexUtils', () => {
  describe('escapeRegex', () => {
    it('should escape special characters', () => {
      const result = escapeRegex('.*+?^${}()|[]\\');
      expect(result).toContain('\\');
    });
  });

  describe('matchAll', () => {
    it('should find all matches', () => {
      const result = matchAll('abc123def456', /\d+/g);
      expect(result).toHaveLength(2);
    });
  });

  describe('replaceAll', () => {
    it('should replace all occurrences', () => {
      const result = replaceAll('hello world', 'o', '0');
      expect(result).toBe('hell0 w0rld');
    });
  });

  describe('testRegex', () => {
    it('should test regex pattern', () => {
      expect(testRegex('abc', /^abc$/)).toBe(true);
      expect(testRegex('xyz', /^abc$/)).toBe(false);
    });
  });
});
