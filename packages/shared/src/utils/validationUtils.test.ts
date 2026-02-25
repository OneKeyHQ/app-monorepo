import {
  isValidEmail,
  isValidPassword,
  isValidUsername,
  isValidUrl,
} from './validationUtils';

describe('validationUtils', () => {
  describe('isValidEmail', () => {
    it('should return true for valid email', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
    });

    it('should return false for invalid email', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
    });
  });

  describe('isValidPassword', () => {
    it('should return true for valid password', () => {
      expect(isValidPassword('Password123!')).toBe(true);
    });

    it('should return false for weak password', () => {
      expect(isValidPassword('123')).toBe(false);
      expect(isValidPassword('password')).toBe(false);
    });
  });

  describe('isValidUsername', () => {
    it('should return true for valid username', () => {
      expect(isValidUsername('user123')).toBe(true);
      expect(isValidUsername('user_name')).toBe(true);
    });

    it('should return false for invalid username', () => {
      expect(isValidUsername('')).toBe(false);
      expect(isValidUsername('ab')).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('should return true for valid URL', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
    });

    it('should return false for invalid URL', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });
  });
});
