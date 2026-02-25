import {
  formatNumberWithLocale,
  parseNumberWithLocale,
} from './numberUtils.locale';

describe('numberUtils.locale', () => {
  describe('formatNumberWithLocale', () => {
    it('should format number with en-US locale', () => {
      const result = formatNumberWithLocale(1234567.89, 'en-US');
      expect(result).toContain('1,234,567.89');
    });

    it('should format number with zh-CN locale', () => {
      const result = formatNumberWithLocale(1234567.89, 'zh-CN');
      expect(result).toContain('1234567.89');
    });

    it('should handle small numbers', () => {
      const result = formatNumberWithLocale(0.001, 'en-US');
      expect(result).toContain('0.001');
    });
  });

  describe('parseNumberWithLocale', () => {
    it('should parse number with en-US locale', () => {
      const result = parseNumberWithLocale('1,234,567.89', 'en-US');
      expect(result).toBe(1234567.89);
    });

    it('should parse number without locale', () => {
      const result = parseNumberWithLocale('1234567.89');
      expect(result).toBe(1234567.89);
    });

    it('should return NaN for invalid input', () => {
      const result = parseNumberWithLocale('not-a-number');
      expect(Number.isNaN(result)).toBe(true);
    });
  });
});
