// Shared utility functions for MarketHomeV2 components

import BigNumber from 'bignumber.js';

/**
 * Validate liquidity input to only allow numbers and k/m/b/t/K/M/B/T characters
 * Unit letters can only appear at the end and only one unit is allowed
 * @param value - Input string to validate
 * @returns True if valid, false otherwise
 */
export const validateLiquidityInput = (value: string): boolean => {
  // Pattern: numbers followed by optional single unit at the end
  const validPattern = /^[0-9]*[kmbtKMBT]?$/;
  return validPattern.test(value);
};

/**
 * Parse a string value to number, supporting K/k (thousands), M/m (millions), B/b (billions), T/t (trillions) suffixes
 * Unit letters can only appear at the end and only one unit is allowed
 * @param value - String value like "10K", "5M", "2B", "1T", "1000"
 * @returns Parsed number value using BigNumber for precision
 */
export const parseValueToNumber = (value: string): number => {
  if (!value || value.trim() === '') {
    return 0;
  }

  const trimmedValue = value.trim();

  // Check if last character is a unit
  const lastChar = trimmedValue.slice(-1).toLowerCase();
  const isUnit = ['k', 'm', 'b', 't'].includes(lastChar);

  if (isUnit) {
    // Extract number part (everything except the last character)
    const numberPart = trimmedValue.slice(0, -1);

    if (!numberPart || numberPart === '') {
      return 0;
    }

    const numValue = new BigNumber(numberPart);

    switch (lastChar) {
      case 't':
        return numValue.multipliedBy(new BigNumber('1000000000000')).toNumber(); // trillion
      case 'b':
        return numValue.multipliedBy(new BigNumber('1000000000')).toNumber(); // billion
      case 'm':
        return numValue.multipliedBy(new BigNumber('1000000')).toNumber(); // million
      case 'k':
        return numValue.multipliedBy(new BigNumber('1000')).toNumber(); // thousand
      default:
        return numValue.toNumber();
    }
  } else {
    // No unit, just parse as number
    return new BigNumber(trimmedValue).toNumber();
  }
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

/**
 * Validate if the liquidity minimum value does not exceed maximum allowed (1t = 1 trillion)
 * @param value - String value to validate
 * @returns True if value is <= 1t or empty, false otherwise
 */
export const validateMaximumMinLiquidity = (value: string): boolean => {
  if (!value || value.trim() === '') {
    return true; // Empty values are allowed
  }

  const numValue = parseValueToNumber(value.trim());
  const maximumMinValue = 1_000_000_000_000; // 1 trillion

  return numValue <= maximumMinValue;
};
