import {
  getLocale,
  setLocale,
  getDefaultLocale,
} from './localeUtils';

describe('localeUtils', () => {
  describe('getLocale', () => {
    it('should return current locale', () => {
      const result = getLocale();
      expect(typeof result).toBe('string');
    });
  });

  describe('setLocale', () => {
    it('should set locale', () => {
      expect(() => setLocale('en-US')).not.toThrow();
    });
  });

  describe('getDefaultLocale', () => {
    it('should return default locale', () => {
      const result = getDefaultLocale();
      expect(typeof result).toBe('string');
    });
  });
});
