/**
 * Tests for HyperLiquid perps price precision utilities
 * Based on: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/tick-and-lot-size
 */

import BigNumber from 'bignumber.js';

import {
  analyzeOrderBookPrecision,
  calculatePriceScale,
  countDecimalPlaces,
  formatWithPrecision,
  getMostFrequentDecimalPlaces,
  getValidPriceDecimals,
} from './perpsUtils';

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

describe('countDecimalPlaces', () => {
  test('counts decimal places correctly', () => {
    expect(countDecimalPlaces('123')).toBe(0);
    expect(countDecimalPlaces('123.4')).toBe(1);
    expect(countDecimalPlaces('123.45')).toBe(2);
    expect(countDecimalPlaces('0.123456')).toBe(6);
    expect(countDecimalPlaces('0')).toBe(0);
  });
});

describe('getMostFrequentDecimalPlaces', () => {
  test('returns most frequent decimal places', () => {
    // Most frequent is 2 decimal places (appears 3 times)
    expect(
      getMostFrequentDecimalPlaces(['1.23', '4.56', '7.89', '10.1', '11']),
    ).toBe(2);

    // Most frequent is 0 decimal places (appears 2 times)
    expect(getMostFrequentDecimalPlaces(['123', '456', '78.9'])).toBe(0);

    // All same decimal places
    expect(getMostFrequentDecimalPlaces(['1.234', '5.678', '9.012'])).toBe(3);
  });

  test('handles edge cases', () => {
    expect(getMostFrequentDecimalPlaces([])).toBe(2); // Default fallback
    expect(getMostFrequentDecimalPlaces(['123'])).toBe(0); // Single value
  });
});

describe('analyzeOrderBookPrecision', () => {
  test('analyzes precision from order book data', () => {
    const bids = [
      { px: '50123.45', sz: '0.1234' },
      { px: '50122.50', sz: '0.5678' },
    ];
    const asks = [
      { px: '50124.50', sz: '0.2345' },
      { px: '50125.75', sz: '0.6789' },
    ];

    const result = analyzeOrderBookPrecision(bids, asks);

    // Price precision: 3 values with 2 decimals, 1 value with 2 decimals -> most frequent is 2
    expect(result.priceDecimals).toBe(2);

    // Size precision: all values have 4 decimal places
    expect(result.sizeDecimals).toBe(4);
  });

  test('handles mixed precision data', () => {
    const bids = [
      { px: '123.4', sz: '1.23' },
      { px: '124.56', sz: '2.3456' },
    ];
    const asks = [
      { px: '125', sz: '3.456' },
      { px: '126.789', sz: '4.5' },
    ];

    const result = analyzeOrderBookPrecision(bids, asks);

    // Price values: ['123.4', '124.56', '125', '126.789']
    // Decimal places: [1, 2, 0, 3] - all have frequency 1, so returns first encountered (1)
    expect(result.priceDecimals).toBe(1);

    // Size values: ['1.23', '2.3456', '3.456', '4.5']
    // Decimal places: [2, 4, 3, 1] - all have frequency 1, so returns first encountered (2)
    expect(result.sizeDecimals).toBe(2);
  });

  test('handles insufficient data', () => {
    const result = analyzeOrderBookPrecision([], []);
    expect(result.priceDecimals).toBe(2); // Default fallback
    expect(result.sizeDecimals).toBe(4); // Default fallback
  });

  test('handles less than 4 total samples', () => {
    const bids = [{ px: '100.50', sz: '1.2345' }];
    const asks = [{ px: '101.25', sz: '2.3456' }];

    const result = analyzeOrderBookPrecision(bids, asks);
    expect(result.priceDecimals).toBe(2);
    expect(result.sizeDecimals).toBe(4);
  });
});

describe('formatWithPrecision', () => {
  test('formats numbers with specified precision', () => {
    expect(formatWithPrecision('123.456789', 2)).toBe('123.46');
    expect(formatWithPrecision('123.456789', 4)).toBe('123.4568');
    expect(formatWithPrecision('123', 2)).toBe('123.00');
    expect(formatWithPrecision(123.456, 1)).toBe('123.5');
    expect(formatWithPrecision(new BigNumber(3289), 1)).toBe('3289.0');
  });

  test('handles BigNumber input', () => {
    const bn = new BigNumber('123.456789');
    expect(formatWithPrecision(bn, 2)).toBe('123.46');
    expect(formatWithPrecision(bn, 4)).toBe('123.4568');
  });

  test('handles edge cases', () => {
    expect(formatWithPrecision('0', 3)).toBe('0.000');
    expect(formatWithPrecision(Infinity, 2)).toBe('0');
    expect(formatWithPrecision(NaN, 2)).toBe('0');
    expect(formatWithPrecision(new BigNumber(Infinity), 2)).toBe('0');
  });
});
