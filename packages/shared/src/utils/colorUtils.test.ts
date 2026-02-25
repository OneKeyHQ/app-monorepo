import {
  hexToRgb,
  rgbToHex,
  darken,
  lighten,
} from './colorUtils';

describe('colorUtils', () => {
  describe('hexToRgb', () => {
    it('should convert hex to rgb', () => {
      const result = hexToRgb('#FF5733');
      expect(result).toEqual({ r: 255, g: 87, b: 51 });
    });

    it('should handle short hex', () => {
      const result = hexToRgb('#F53');
      expect(result).toEqual({ r: 255, g: 85, b: 51 });
    });
  });

  describe('rgbToHex', () => {
    it('should convert rgb to hex', () => {
      const result = rgbToHex(255, 87, 51);
      expect(result).toBe('#ff5733');
    });
  });

  describe('darken', () => {
    it('should darken color', () => {
      const result = darken('#FF5733', 0.2);
      expect(result).not.toBe('#FF5733');
    });
  });

  describe('lighten', () => {
    it('should lighten color', () => {
      const result = lighten('#FF5733', 0.2);
      expect(result).not.toBe('#FF5733');
    });
  });
});
