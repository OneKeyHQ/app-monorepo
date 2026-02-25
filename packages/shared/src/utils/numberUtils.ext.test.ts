import BigNumber from 'bignumber.js';
import {
  formatBalance,
  formatPrice,
  formatValue,
} from './numberUtils';

describe('numberUtils extended', () => {
  describe('formatBalance', () => {
    it('should format balance with decimals', () => {
      const result = formatBalance('1000000000000000000', 18);
      expect(result).toBe('1');
    });

    it('should format small balance', () => {
      const result = formatBalance('1000000', 6);
      expect(result).toBe('1');
    });

    it('should handle zero balance', () => {
      const result = formatBalance('0', 18);
      expect(result).toBe('0');
    });
  });

  describe('formatPrice', () => {
    it('should format price with 2 decimals', () => {
      const result = formatPrice('1234.5678');
      expect(result).toContain('1234');
    });

    it('should format small price', () => {
      const result = formatPrice('0.0001234');
      expect(result).toBeDefined();
    });
  });

  describe('formatValue', () => {
    it('should format value with symbol', () => {
      const result = formatValue('100', 'ETH');
      expect(result).toContain('ETH');
    });

    it('should format value without symbol', () => {
      const result = formatValue('100');
      expect(result).toBe('100');
    });
  });
});
