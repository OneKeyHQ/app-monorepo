import {
  clamp,
  lerp,
  mapRange,
  roundTo,
} from './mathUtils';

describe('mathUtils', () => {
  describe('clamp', () => {
    it('should clamp value to range', () => {
      expect(clamp(10, 0, 5)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(5, 0, 10)).toBe(5);
    });
  });

  describe('lerp', () => {
    it('should linear interpolate', () => {
      expect(lerp(0, 10, 0.5)).toBe(5);
      expect(lerp(0, 10, 0)).toBe(0);
      expect(lerp(0, 10, 1)).toBe(10);
    });
  });

  describe('mapRange', () => {
    it('should map value from one range to another', () => {
      const result = mapRange(50, 0, 100, 0, 1);
      expect(result).toBe(0.5);
    });
  });

  describe('roundTo', () => {
    it('should round to specified decimals', () => {
      expect(roundTo(3.14159, 2)).toBe(3.14);
      expect(roundTo(3.14159, 4)).toBe(3.1416);
    });
  });
});
