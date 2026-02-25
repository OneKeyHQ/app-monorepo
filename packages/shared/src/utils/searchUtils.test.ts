import {
  fuzzySearch,
  exactSearch,
  prefixSearch,
  suffixSearch,
} from './searchUtils';

describe('searchUtils', () => {
  describe('fuzzySearch', () => {
    it('should find fuzzy matches', () => {
      const arr = ['hello world', 'helpful', 'hell', 'goodbye'];
      const result = fuzzySearch(arr, 'hllo');
      expect(result).toContain('hello world');
    });

    it('should return empty for no matches', () => {
      const arr = ['hello', 'world'];
      const result = fuzzySearch(arr, 'xyz');
      expect(result).toHaveLength(0);
    });
  });

  describe('exactSearch', () => {
    it('should find exact matches', () => {
      const arr = ['hello', 'Hello', 'HELLO'];
      const result = exactSearch(arr, 'hello');
      expect(result).toContain('hello');
    });
  });

  describe('prefixSearch', () => {
    it('should find prefix matches', () => {
      const arr = ['apple', 'application', 'banana'];
      const result = prefixSearch(arr, 'app');
      expect(result).toContain('apple');
      expect(result).toContain('application');
    });
  });

  describe('suffixSearch', () => {
    it('should find suffix matches', () => {
      const arr = ['running', 'jumping', 'walk'];
      const result = suffixSearch(arr, 'ing');
      expect(result).toContain('running');
      expect(result).toContain('jumping');
    });
  });
});
