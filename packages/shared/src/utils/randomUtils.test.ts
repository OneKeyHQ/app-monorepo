import {
  generateRandomString,
  generateRandomNumber,
  generateUUID,
} from './randomUtils';

describe('randomUtils', () => {
  describe('generateRandomString', () => {
    it('should generate random string of specified length', () => {
      const result = generateRandomString(10);
      expect(result).toHaveLength(10);
    });

    it('should generate different strings', () => {
      const str1 = generateRandomString(10);
      const str2 = generateRandomString(10);
      expect(str1).not.toBe(str2);
    });
  });

  describe('generateRandomNumber', () => {
    it('should generate number within range', () => {
      const result = generateRandomNumber(1, 100);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(100);
    });
  });

  describe('generateUUID', () => {
    it('should generate valid UUID', () => {
      const result = generateUUID();
      expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });
});
