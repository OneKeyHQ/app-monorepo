// Shared utility functions for MarketHomeV2 components

import BigNumber from 'bignumber.js';

/**
 * Validate liquidity input to only allow numbers and k/m/b/t/K/M/B/T characters
 * @param value - Input string to validate
 * @returns True if valid, false otherwise
 */
export const validateLiquidityInput = (value: string): boolean => {
  // Only allow numbers and k/m/b/t/K/M/B/T characters (no decimal point)
  const validPattern = /^[0-9kmbtKMBT]*$/;
  return validPattern.test(value);
};

/**
 * Parse a string value to number, supporting K/k (thousands), M/m (millions), B/b (billions), T/t (trillions) suffixes
 * @param value - String value like "10K", "5M", "2B", "1T", "1000"
 * @returns Parsed number value using BigNumber for precision
 */
export const parseValueToNumber = (value: string): number => {
  // Only remove characters that are not numbers or unit letters (no decimal points)
  const cleanValue = value
    .replace(/[^0-9kmbtKMBT]/g, '')
    .replace(/[kmbtKMBT]/g, '');

  if (!cleanValue || cleanValue === '') {
    return 0;
  }

  const numValue = new BigNumber(cleanValue);
  const lowerValue = value.toLowerCase();

  if (lowerValue.includes('t')) {
    return numValue.multipliedBy(new BigNumber('1000000000000')).toNumber(); // trillion
  }
  if (lowerValue.includes('b')) {
    return numValue.multipliedBy(new BigNumber('1000000000')).toNumber(); // billion
  }
  if (lowerValue.includes('m')) {
    return numValue.multipliedBy(new BigNumber('1000000')).toNumber(); // million
  }
  if (lowerValue.includes('k')) {
    return numValue.multipliedBy(new BigNumber('1000')).toNumber(); // thousand
  }
  return numValue.toNumber();
};

/**
 * Format liquidity filter values for display
 * @param filter - Liquidity filter object with min and max values
 * @param liquidityText - Translated liquidity text
 * @returns Formatted string for button display
 */
export const formatLiquidityFilterDisplay = (
  filter?: {
    min?: string;
    max?: string;
  },
  liquidityText = 'Liquidity',
): string => {
  if (!filter || (!filter.min && !filter.max)) {
    return liquidityText;
  }

  const { min, max } = filter;

  // Clean up empty strings
  const cleanMin = min?.trim();
  const cleanMax = max?.trim();

  if (cleanMin && cleanMax) {
    return `${liquidityText}: ${cleanMin} - ${cleanMax}`;
  }

  if (cleanMin && !cleanMax) {
    return `${liquidityText}: ≥ ${cleanMin}`;
  }

  if (!cleanMin && cleanMax) {
    return `${liquidityText}: ≤ ${cleanMax}`;
  }

  return liquidityText;
};
