/**
 * HyperLiquid perps price precision utilities
 * Based on: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/tick-and-lot-size
 */

import BigNumber from 'bignumber.js';

const MAX_DECIMALS_PERP = 6;
const MAX_SIGNIFICANT_FIGURES = 5;

/**
 * Count significant figures in a BigNumber
 */
function _countSignificantFigures(price: BigNumber): number {
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
  if (price.isInteger()) {
    return 0;
  }

  // Rule 2: Non-integer prices - apply 5 significant figures limit
  const priceStr = price.toFixed();
  const decimalIndex = priceStr.indexOf('.');

  if (decimalIndex === -1) {
    return 0; // No decimal point
  }

  const actualDecimals = priceStr.length - decimalIndex - 1;
  const significantFigures = _countSignificantFigures(price);

  // For non-integer prices, respect both significant figures and MAX_DECIMALS limits
  let maxAllowedDecimals = Math.min(actualDecimals, MAX_DECIMALS_PERP);

  // Apply 5 significant figures limit
  if (significantFigures > MAX_SIGNIFICANT_FIGURES) {
    const integerPart = price.integerValue(BigNumber.ROUND_DOWN);
    const integerDigits = integerPart.isZero()
      ? 0
      : integerPart.toFixed().length;

    if (integerDigits >= MAX_SIGNIFICANT_FIGURES) {
      maxAllowedDecimals = 0;
    } else {
      const remainingSignificantFigures =
        MAX_SIGNIFICANT_FIGURES - integerDigits;
      maxAllowedDecimals = Math.min(
        maxAllowedDecimals,
        remainingSignificantFigures,
      );
    }
  }

  return Math.max(0, maxAllowedDecimals);
}

/**
 * Calculate maximum decimal places for TradingView price scale
 *
 * This determines the precision that should be supported for trading,
 * allowing users to input prices with appropriate decimal precision.
 *
 * @param marketPrice - The market price to analyze
 * @returns Maximum decimal places for price scale
 */
function getPriceScaleDecimals(marketPrice: string | number): number {
  const price = new BigNumber(marketPrice);

  if (!price.isFinite() || price.isLessThanOrEqualTo(0)) {
    return 2; // Default fallback
  }

  // Calculate integer digits
  const integerPart = price.integerValue(BigNumber.ROUND_DOWN);
  const integerDigits = integerPart.isZero() ? 0 : integerPart.toFixed().length;

  // For TradingView price scale: determine max decimals that would still be valid
  // under HyperLiquid's rules for non-integer prices (5 significant figures max)

  if (integerDigits >= MAX_SIGNIFICANT_FIGURES) {
    // If integer part already uses all 5 significant figures, no decimals allowed
    return 0;
  }

  // Calculate max decimals that keep within 5 sig figs rule for non-integers
  const maxAllowedDecimals = Math.min(
    MAX_SIGNIFICANT_FIGURES - integerDigits,
    MAX_DECIMALS_PERP,
  );

  return Math.max(0, maxAllowedDecimals);
}

/**
 * Calculate price scale (10^decimals) for TradingView based on valid decimals
 *
 * @param marketPrice - The market price to analyze
 * @returns Price scale for TradingView (e.g., 100 for 2 decimals)
 */
function calculatePriceScale(marketPrice: string | number): number {
  const validDecimals = getPriceScaleDecimals(marketPrice);
  return new BigNumber(10).pow(validDecimals).toNumber();
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

export {
  getValidPriceDecimals,
  getPriceScaleDecimals,
  calculatePriceScale,
  formatPriceToValid,
};

export default {
  getValidPriceDecimals,
  getPriceScaleDecimals,
  calculatePriceScale,
  formatPriceToValid,
};
