import {
  animate,
  easeInOut,
  easeIn,
  easeOut,
} from './animationUtils';

describe('animationUtils', () => {
  describe('easeIn', () => {
    it('should return 0 for t=0', () => {
      expect(easeIn(0)).toBe(0);
    });

    it('should return 1 for t=1', () => {
      expect(easeIn(1)).toBe(1);
    });
  });

  describe('easeOut', () => {
    it('should return 0 for t=0', () => {
      expect(easeOut(0)).toBe(0);
    });

    it('should return 1 for t=1', () => {
      expect(easeOut(1)).toBe(1);
    });
  });

  describe('easeInOut', () => {
    it('should return 0 for t=0', () => {
      expect(easeInOut(0)).toBe(0);
    });

    it('should return 1 for t=1', () => {
      expect(easeInOut(1)).toBe(1);
    });
  });

  describe('animate', () => {
    it('should have animate method', () => {
      expect(typeof animate).toBe('function');
    });
  });
});
