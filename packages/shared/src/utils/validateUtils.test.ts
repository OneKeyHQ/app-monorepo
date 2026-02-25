import {
  isRequired,
  isMinLength,
  isMaxLength,
  isPattern,
  isEmail,
  isUrl,
} from './validateUtils';

describe('validateUtils', () => {
  describe('isRequired', () => {
    it('should validate required field', () => {
      expect(isRequired('value')).toBe(true);
      expect(isRequired('')).toBe(false);
      expect(isRequired(null)).toBe(false);
      expect(isRequired(undefined)).toBe(false);
    });
  });

  describe('isMinLength', () => {
    it('should validate minimum length', () => {
      expect(isMinLength('hello', 3)).toBe(true);
      expect(isMinLength('hi', 3)).toBe(false);
    });
  });

  describe('isMaxLength', () => {
    it('should validate maximum length', () => {
      expect(isMaxLength('hi', 5)).toBe(true);
      expect(isMaxLength('hello world', 5)).toBe(false);
    });
  });

  describe('isPattern', () => {
    it('should validate pattern', () => {
      expect(isPattern('abc123', /^[a-z0-9]+$/)).toBe(true);
      expect(isPattern('ABC', /^[a-z]+$/)).toBe(false);
    });
  });

  describe('isEmail', () => {
    it('should validate email', () => {
      expect(isEmail('test@example.com')).toBe(true);
      expect(isEmail('invalid')).toBe(false);
    });
  });

  describe('isUrl', () => {
    it('should validate URL', () => {
      expect(isUrl('https://example.com')).toBe(true);
      expect(isUrl('not-a-url')).toBe(false);
    });
  });
});
