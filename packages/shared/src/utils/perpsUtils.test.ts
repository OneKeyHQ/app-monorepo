/**
 * Tests for HyperLiquid perps price precision utilities
 * Based on: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/tick-and-lot-size
 */

import { calculatePriceScale, getValidPriceDecimals } from './perpsUtils';

describe('getValidPriceDecimals - HyperLiquid Perp Rules', () => {
  // Rule: Integer prices are always allowed, regardless of significant figures
  test('integer prices', () => {
    expect(getValidPriceDecimals('123456')).toBe(0); // 6 digits still valid as integer
    expect(getValidPriceDecimals('4368')).toBe(0); // ETH example
  });

  // Rule: Up to 5 significant figures
  test('5 significant figures rule', () => {
    expect(getValidPriceDecimals('1234.5')).toBe(1); // Valid
    expect(getValidPriceDecimals('1234.56')).toBe(1); // Invalid, truncated to 5 sig figs
  });

  // Rule: No more than MAX_DECIMALS - szDecimals (6 - 0 = 6 for perps)
  test('max decimals constraint', () => {
    expect(getValidPriceDecimals('0.001234')).toBe(6); // Valid
    expect(getValidPriceDecimals('0.0012345')).toBe(6); // Invalid, truncated to 6 decimals
  });

  // Note: Current implementation assumes szDecimals = 0, so max decimals = 6
  test('edge cases', () => {
    expect(getValidPriceDecimals('0.01234')).toBe(5); // 5 significant figures
    expect(getValidPriceDecimals('0.012345')).toBe(6); // 6 decimals (within MAX_DECIMALS)
  });
});

describe('calculatePriceScale - TradingView Price Scale', () => {
  test('ETH price scale calculation', () => {
    expect(calculatePriceScale('4368')).toBe(10); // 4 digits -> 1 decimal -> scale 10
    expect(calculatePriceScale('1234.0')).toBe(10);
  });

  test('price scale by digit count', () => {
    expect(calculatePriceScale('1')).toBe(10_000); // 1 digit -> scale 10000
    expect(calculatePriceScale('12')).toBe(1000); // 2 digits -> scale 1000
    expect(calculatePriceScale('123')).toBe(100); // 3 digits -> scale 100
    expect(calculatePriceScale('1234')).toBe(10); // 4 digits -> scale 10
    expect(calculatePriceScale('12345')).toBe(1); // 5+ digits -> scale 1
  });
});
