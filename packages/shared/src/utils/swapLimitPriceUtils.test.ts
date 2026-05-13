import {
  formatSwapLimitTokenPriceInputValue,
  getSwapLimitPriceRateDecimals,
} from './swapLimitPriceUtils';

describe('swapLimitPriceUtils', () => {
  test('keeps enough rate precision for stablecoin quote pairs', () => {
    expect(getSwapLimitPriceRateDecimals(6)).toBe(18);
    expect(getSwapLimitPriceRateDecimals(24)).toBe(24);
    expect(getSwapLimitPriceRateDecimals()).toBe(18);
  });

  test('formats tiny token prices without rounding them to zero', () => {
    expect(formatSwapLimitTokenPriceInputValue('0.0000000214562')).toBe(
      '0.00000002146',
    );
    expect(formatSwapLimitTokenPriceInputValue('0.0000000002146')).toBe(
      '0.0000000002146',
    );
  });

  test('uses plain input-safe strings for normal prices', () => {
    expect(formatSwapLimitTokenPriceInputValue('1.230000')).toBe('1.23');
    expect(formatSwapLimitTokenPriceInputValue('1234.56789123')).toBe(
      '1234.567891',
    );
    expect(formatSwapLimitTokenPriceInputValue('0')).toBe('');
  });
});
