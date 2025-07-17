// Shared utility functions for MarketHomeV2 components

/**
 * Validate liquidity input to only allow numbers and k/m/K/M characters
 * @param value - Input string to validate
 * @returns True if valid, false otherwise
 */
export const validateLiquidityInput = (value: string): boolean => {
  // Only allow numbers and k/m/K/M characters (no decimal point)
  const validPattern = /^[0-9kmKM]*$/;
  return validPattern.test(value);
};

/**
 * Parse a string value to number, supporting K (thousands) and M (millions) suffixes
 * @param value - String value like "10K", "5M", "1000"
 * @returns Parsed number value
 */
export const parseValueToNumber = (value: string): number => {
  // Only remove characters that are not numbers or k/m letters (no decimal points)
  const cleanValue = value.replace(/[^0-9kmKM]/g, '').replace(/[kmKM]/g, '');
  const numValue = parseInt(cleanValue, 10);

  if (value.toLowerCase().includes('k')) {
    return numValue * 1000;
  }
  if (value.toLowerCase().includes('m')) {
    return numValue * 1_000_000;
  }
  return numValue;
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
