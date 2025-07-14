// Shared utility functions for MarketHomeV2 components

/**
 * Parse a string value to number, supporting K (thousands) and M (millions) suffixes
 * @param value - String value like "10K", "5M", "1000"
 * @returns Parsed number value
 */
export const parseValueToNumber = (value: string): number => {
  const cleanValue = value.replace(/[^0-9.]/g, '');
  const numValue = parseFloat(cleanValue);

  if (value.toLowerCase().includes('k')) {
    return numValue * 1000;
  }
  if (value.toLowerCase().includes('m')) {
    return numValue * 1_000_000;
  }
  return numValue;
};

/**
 * Format a number to k and m units
 * @param value - Number value to format
 * @returns Formatted string with k or m suffix
 */
export const formatNumberToKM = (value: number): string => {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return millions % 1 === 0 ? `${millions}M` : `${millions.toFixed(1)}M`;
  }
  if (value >= 1000) {
    const thousands = value / 1000;
    return thousands % 1 === 0 ? `${thousands}K` : `${thousands.toFixed(1)}K`;
  }
  return value.toString();
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
