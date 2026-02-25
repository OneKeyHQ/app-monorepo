import {
  getElementById,
  addClass,
  removeClass,
  hasClass,
} from './domUtils';

describe('domUtils', () => {
  describe('getElementById', () => {
    it('should have getElementById method', () => {
      expect(typeof getElementById).toBe('function');
    });
  });

  describe('addClass', () => {
    it('should have addClass method', () => {
      expect(typeof addClass).toBe('function');
    });
  });

  describe('removeClass', () => {
    it('should have removeClass method', () => {
      expect(typeof removeClass).toBe('function');
    });
  });

  describe('hasClass', () => {
    it('should have hasClass method', () => {
      expect(typeof hasClass).toBe('function');
    });
  });
});
