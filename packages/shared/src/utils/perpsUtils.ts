/**
 * HyperLiquid perps price precision utilities
 * Based on: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/tick-and-lot-size
 */

import BigNumber from 'bignumber.js';

const MAX_DECIMALS_PERP = 6;
const MAX_SIGNIFICANT_FIGURES = 5;

/**
 * Check if a number is effectively an integer (no meaningful decimal places)
 */
function isEffectivelyInteger(price: BigNumber): boolean {
  return price.isInteger();
}

/**
 * Count significant figures in a BigNumber
 */
function countSignificantFigures(price: BigNumber): number {
  if (price.isZero()) return 1;

  const priceStr = price.toFixed(); // Get fixed decimal representation
  const scientificMatch = priceStr.match(/^(\d+(?:\.\d+)?)e([+-]?\d+)$/i);

  if (scientificMatch) {
    // Handle scientific notation
    const [, mantissa] = scientificMatch;
    return mantissa.replace('.', '').replace(/^0+/, '').length;
  }

  // Remove decimal point and leading zeros
  const digits = priceStr.replace('.', '').replace(/^0+/, '');
  return digits.length;
}

/**
 * Calculate valid decimal places for HyperLiquid perp prices
 *
 * HyperLiquid rules:
 * 1. Integer prices are always allowed (regardless of significant figures)
 * 2. Non-integer prices: max 5 significant figures
 * 3. Max decimal places = MAX_DECIMALS_PERP (6 for perps, assuming szDecimals=0)
 *
 * @param marketPrice - The market price to analyze
 * @returns Valid decimal places for the price
 */
function getValidPriceDecimals(marketPrice: string | number): number {
  const price = new BigNumber(marketPrice);

  if (!price.isFinite() || price.isLessThanOrEqualTo(0)) {
    return 2; // Default fallback
  }

  // Rule 1: Integer prices are always allowed
  if (isEffectivelyInteger(price)) {
    return 0;
  }

  // Rule 2: Non-integer prices - apply 5 significant figures limit
  const priceStr = price.toFixed();
  const decimalIndex = priceStr.indexOf('.');

  if (decimalIndex === -1) {
    return 0; // No decimal point
  }

  const actualDecimals = priceStr.length - decimalIndex - 1;
  const significantFigures = countSignificantFigures(price);

  // Calculate max allowed decimals based on significant figures constraint
  const integerPart = price.integerValue(BigNumber.ROUND_DOWN);
  const integerDigits = integerPart.isZero() ? 0 : integerPart.toFixed().length;

  let maxAllowedDecimals = actualDecimals;

  // Apply 5 significant figures limit for non-integer prices
  if (significantFigures > MAX_SIGNIFICANT_FIGURES) {
    if (integerDigits >= MAX_SIGNIFICANT_FIGURES) {
      maxAllowedDecimals = 0;
    } else {
      const remainingSignificantFigures =
        MAX_SIGNIFICANT_FIGURES - integerDigits;
      maxAllowedDecimals = Math.min(
        actualDecimals,
        remainingSignificantFigures,
      );
    }
  }

  // Rule 3: Also limit by MAX_DECIMALS_PERP (assuming szDecimals=0)
  maxAllowedDecimals = Math.min(maxAllowedDecimals, MAX_DECIMALS_PERP);

  return Math.max(0, maxAllowedDecimals);
}

/**
 * Calculate price scale (10^decimals) for TradingView based on valid decimals
 *
 * @param marketPrice - The market price to analyze
 * @returns Price scale for TradingView (e.g., 100 for 2 decimals)
 */
function calculatePriceScale(marketPrice: string | number): number {
  const validDecimals = getValidPriceDecimals(marketPrice);
  return new BigNumber(10).exponentiatedBy(validDecimals).toNumber();
}

/**
 * Format price according to HyperLiquid precision rules
 *
 * @param marketPrice - The market price to format
 * @returns Formatted price string
 */
function formatPriceToValid(marketPrice: string | number): string {
  const price = new BigNumber(marketPrice);

  if (!price.isFinite() || price.isLessThanOrEqualTo(0)) {
    return '0';
  }

  const validDecimals = getValidPriceDecimals(marketPrice);

  // Format with valid decimals and remove trailing zeros as per HyperLiquid signing requirements
  return price.toFixed(validDecimals).replace(/\.?0+$/, '');
}

export { getValidPriceDecimals, calculatePriceScale, formatPriceToValid };

export default {
  getValidPriceDecimals,
  calculatePriceScale,
  formatPriceToValid,
};
