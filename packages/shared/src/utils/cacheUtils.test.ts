import {
  createCache,
  getCache,
  setCache,
  clearCache,
} from './cacheUtils';

describe('cacheUtils', () => {
  describe('createCache', () => {
    it('should create cache instance', () => {
      const cache = createCache();
      expect(cache).toBeDefined();
    });
  });

  describe('setCache & getCache', () => {
    it('should set and get cache value', () => {
      setCache('key', 'value');
      const result = getCache('key');
      expect(result).toBe('value');
    });

    it('should return undefined for non-existent key', () => {
      const result = getCache('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('clearCache', () => {
    it('should clear all cache', () => {
      setCache('key1', 'value1');
      clearCache();
      const result = getCache('key1');
      expect(result).toBeUndefined();
    });
  });
});
