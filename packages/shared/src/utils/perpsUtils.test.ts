/**
 * Tests for HyperLiquid perps price precision utilities
 * Based on: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/tick-and-lot-size
 */

import { getValidPriceDecimals } from './perpsUtils';

describe('getValidPriceDecimals', () => {
  describe('Integer prices (always allowed)', () => {
    test('should handle large integer prices', () => {
      // 123456 is valid even though it has 6 significant figures
      expect(getValidPriceDecimals('123456')).toBe(0);
      expect(getValidPriceDecimals(123_456)).toBe(0);
    });

    test('should handle small integer prices', () => {
      expect(getValidPriceDecimals('1')).toBe(0);
      expect(getValidPriceDecimals('12')).toBe(0);
      expect(getValidPriceDecimals('123')).toBe(0);
      expect(getValidPriceDecimals(1000)).toBe(0);
    });
  });

  describe('Non-integer prices with 5 significant figures constraint', () => {
    test('should handle valid prices with exactly 5 significant figures', () => {
      // 1234.5 is valid (4 integer + 1 decimal = 5 significant figures)
      expect(getValidPriceDecimals('1234.5')).toBe(1);

      // 123.45 is valid (3 integer + 2 decimal = 5 significant figures)
      expect(getValidPriceDecimals('123.45')).toBe(2);

      // 12.345 is valid (2 integer + 3 decimal = 5 significant figures)
      expect(getValidPriceDecimals('12.345')).toBe(3);

      // 1.2345 is valid (1 integer + 4 decimal = 5 significant figures)
      expect(getValidPriceDecimals('1.2345')).toBe(4);
    });

    test('should limit prices with more than 5 significant figures', () => {
      // 1234.56 has 6 significant figures, should be limited to 1 decimal place
      expect(getValidPriceDecimals('1234.56')).toBe(1);

      // 123.456 has 6 significant figures, should be limited to 2 decimal places
      expect(getValidPriceDecimals('123.456')).toBe(2);

      // 12.3456 has 6 significant figures, should be limited to 3 decimal places
      expect(getValidPriceDecimals('12.3456')).toBe(3);
    });

    test('should handle prices with integer part >= 5 digits', () => {
      // 12345.6 has 6 significant figures, integer part is 5 digits
      // Should be limited to 0 decimal places
      expect(getValidPriceDecimals('12345.6')).toBe(0);

      // 123456.789 has integer part >= 5 digits
      // Should be limited to 0 decimal places
      expect(getValidPriceDecimals('123456.789')).toBe(0);
    });
  });

  describe('Decimal places constraint (MAX_DECIMALS = 6 for perps)', () => {
    test('should handle valid prices within 6 decimal places', () => {
      // 0.001234 is valid (6 decimal places, 5 significant figures)
      expect(getValidPriceDecimals('0.001234')).toBe(6);

      // 0.123456 is valid (6 decimal places, but limited by 5 sig figs)
      expect(getValidPriceDecimals('0.123456')).toBe(5);
    });

    test('should limit prices with more than 6 decimal places', () => {
      // 0.0012345 has 7 decimal places, should be limited to 6
      expect(getValidPriceDecimals('0.0012345')).toBe(6);

      // 0.1234567 has 7 decimal places, should be limited to 6
      expect(getValidPriceDecimals('0.1234567')).toBe(5); // Limited by 5 sig figs
    });

    test('should handle very small prices', () => {
      // 0.000001 is valid (6 decimal places, 1 significant figure)
      expect(getValidPriceDecimals('0.000001')).toBe(6);

      // 0.0000123 has 7 decimal places, should be limited to 6
      expect(getValidPriceDecimals('0.0000123')).toBe(6);
    });
  });

  describe('Edge cases from HyperLiquid examples', () => {
    test('should handle documented valid examples', () => {
      // 1234.5 is valid but 1234.56 is not (too many significant figures)
      expect(getValidPriceDecimals('1234.5')).toBe(1);

      // 0.001234 is valid, but 0.0012345 is not (more than 6 decimal places)
      expect(getValidPriceDecimals('0.001234')).toBe(6);
    });

    test('should limit documented invalid examples', () => {
      // 1234.56 is not valid (too many significant figures)
      // Should be limited to 1 decimal place
      expect(getValidPriceDecimals('1234.56')).toBe(1);

      // 0.0012345 is not valid (more than 6 decimal places)
      // Should be limited to 6 decimal places
      expect(getValidPriceDecimals('0.0012345')).toBe(6);
    });
  });

  describe('szDecimals constraint examples (assuming szDecimals = 0)', () => {
    test('should handle prices within MAX_DECIMALS - szDecimals limit', () => {
      // With szDecimals = 0, max decimal places = 6 - 0 = 6
      // But still limited by 5 significant figures rule

      // 1.123456 has 7 significant figures, limited to 4 decimals (1+4=5 sig figs)
      expect(getValidPriceDecimals('1.123456')).toBe(4);

      // 12.12345 has 7 significant figures, limited to 3 decimals (2+3=5 sig figs)
      expect(getValidPriceDecimals('12.12345')).toBe(3);

      // 123.1234 has 7 significant figures, limited to 2 decimals (3+2=5 sig figs)
      expect(getValidPriceDecimals('123.1234')).toBe(2);
    });
  });

  describe('Input validation', () => {
    test('should handle string inputs', () => {
      expect(getValidPriceDecimals('1234.5')).toBe(1);
      expect(getValidPriceDecimals('0.001234')).toBe(6);
    });

    test('should handle number inputs', () => {
      expect(getValidPriceDecimals(1234.5)).toBe(1);
      expect(getValidPriceDecimals(0.001_234)).toBe(6);
    });

    test('should handle invalid inputs with fallback', () => {
      // Should return default 2 decimal places
      expect(getValidPriceDecimals(0)).toBe(2);
      expect(getValidPriceDecimals(-1)).toBe(2);
      expect(getValidPriceDecimals('invalid')).toBe(2);
      expect(getValidPriceDecimals('')).toBe(2);
    });

    test('should handle edge numeric values', () => {
      expect(getValidPriceDecimals(0.1)).toBe(1);
      expect(getValidPriceDecimals(0.01)).toBe(2);
      expect(getValidPriceDecimals(0.001)).toBe(3);
    });
  });

  describe('Real-world crypto price examples', () => {
    test('should handle typical crypto prices', () => {
      // Bitcoin-like prices
      expect(getValidPriceDecimals('45123')).toBe(0); // Integer
      expect(getValidPriceDecimals('45123.4')).toBe(0); // 5 integer digits, limited to 0 decimals

      // Use 4-digit integer prices instead
      expect(getValidPriceDecimals('4512.3')).toBe(1); // 1 decimal (4+1=5 sig figs)

      // Ethereum-like prices
      expect(getValidPriceDecimals('2534.67')).toBe(1); // Limited by 5 sig figs (4+1=5)

      // Alt coin prices
      expect(getValidPriceDecimals('1.2345')).toBe(4); // 4 decimals (1+4=5 sig figs)
      expect(getValidPriceDecimals('0.123456')).toBe(5); // Limited by 5 sig figs

      // Very small prices
      expect(getValidPriceDecimals('0.000123')).toBe(6); // 6 decimals (5 sig figs)
    });
  });
});
