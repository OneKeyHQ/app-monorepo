/**
 * HyperLiquid perps price precision utilities
 * Based on: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/tick-and-lot-size
 */

import BigNumber from 'bignumber.js';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  EPerpsSizeInputMode,
  IPerpsFormattedAssetCtx,
  ISpotFormattedAssetCtx,
} from '@onekeyhq/shared/types/hyperliquid';
import {
  MAX_DECIMALS_PERP,
  MAX_DECIMALS_SPOT,
  MAX_PRICE_INTEGER_DIGITS,
  MAX_SIGNIFICANT_FIGURES,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type {
  IPerpsAssetCtx,
  IPerpsUniverse,
  ISpotAssetCtx,
  IWsActiveAssetCtx,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import { ETriggerOrderType } from '@onekeyhq/shared/types/hyperliquid/types';
import type {
  IPerpTokenSortDirection,
  IPerpTokenSortField,
} from '@onekeyhq/shared/types/hyperliquid/types';

import { numberFormat } from './numberUtils';

// Types for liquidation price calculation
interface IMarginTier {
  lowerBound: string;
  maxLeverage: number;
}

interface ILiquidationPriceParams {
  totalValue: BigNumber;
  referencePrice: BigNumber;
  markPrice?: BigNumber;
  clampToCurrentMark?: boolean;
  positionSize: BigNumber;
  side: 'long' | 'short';
  leverage: number;
  mode: string;
  marginTiers: IMarginTier[] | undefined;
  maxLeverage: number;
  // For cross mode
  crossMarginUsed?: BigNumber;
  crossMaintenanceMarginUsed?: BigNumber;
}

interface ICombinePositionParams {
  existingPositionSize: BigNumber; // currentCoinCrossPosition.szi (signed)
  existingEntryPrice: BigNumber; // currentCoinCrossPosition.entryPx
  newOrderSize: BigNumber; // formData.size (absolute value)
  newOrderSide: 'long' | 'short'; // formData.side
  newOrderPrice: BigNumber; // execution/reference price
}

interface ICombinePositionResult {
  finalSize: BigNumber; // final position size (absolute value)
  finalSide: 'long' | 'short'; // final position side
  finalEntryPrice: BigNumber; // final entry price
  isEmpty: boolean; // whether completely closed
}

interface IProfitLossParams {
  entryPrice: string | number | BigNumber;
  exitPrice: string | number | BigNumber;
  amount: string | number | BigNumber;
  side: 'long' | 'short';
  formatOptions?: {
    currency?: string;
    decimals?: number;
    showSign?: boolean;
  };
}

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
 * Determine decimal precision for UI display.
 *
 * Keeps the strict HyperLiquid baseline but, when prices are below 1, preserves
 * the natural decimal length (capped by MAX_DECIMALS_PERP) so that tiny price
 * increments are visible in the UI even if they exceed the trading constraint.
 */
function getDisplayPriceScaleDecimals(marketPrice: string | number): number {
  const baseline = getPriceScaleDecimals(marketPrice);
  const price = new BigNumber(marketPrice);

  if (!price.isFinite() || price.isLessThanOrEqualTo(0)) {
    return baseline;
  }

  if (price.isGreaterThanOrEqualTo(1)) {
    return baseline;
  }

  const priceStr = price.toFixed();
  const decimalIndex = priceStr.indexOf('.');
  if (decimalIndex === -1) {
    return baseline;
  }

  const actualDecimals = priceStr.length - decimalIndex - 1;
  const clampedActual = Math.min(actualDecimals, MAX_DECIMALS_PERP);

  return Math.max(baseline, clampedActual);
}

function calculateDisplayPriceScale(marketPrice: string | number): number {
  const validDecimals = getDisplayPriceScaleDecimals(marketPrice);
  return new BigNumber(10).pow(validDecimals).toNumber();
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

/**
 * Count decimal places in a string number
 */
function countDecimalPlaces(value: string): number {
  const decimalIndex = value.indexOf('.');
  if (decimalIndex === -1) return 0;
  return value.length - decimalIndex - 1;
}

/**
 * Get the most frequent decimal place count from an array of values
 */
function getMostFrequentDecimalPlaces(values: string[]): number {
  if (values.length === 0) return 2; // Default fallback

  const decimalCounts = values.map(countDecimalPlaces);
  const frequency: { [key: number]: number } = {};
  // Count frequency of each decimal place count
  decimalCounts.forEach((count) => {
    frequency[count] = (frequency[count] || 0) + 1;
  });

  // Find the decimal place count with highest frequency
  let maxFrequency = 0;
  let mostFrequentDecimals = 2; // Default

  Object.entries(frequency).forEach(([decimals, freq]) => {
    if (freq > maxFrequency) {
      maxFrequency = freq;
      mostFrequentDecimals = parseInt(decimals, 10);
    }
  });

  // If no clear winner (all have same frequency), use the first decimal count encountered
  if (maxFrequency === 1 && Object.keys(frequency).length > 1) {
    mostFrequentDecimals = decimalCounts[0];
  }

  return mostFrequentDecimals;
}

/**
 * Analyze decimal places requirements from order book data
 *
 * Takes the first 2 levels from bids and asks (up to 4 total levels) and analyzes:
 * - Price decimal places from px values
 * - Size decimal places from sz values (applies to both size and cumSize)
 *
 * @param bids - Array of bid levels
 * @param asks - Array of ask levels
 * @returns Object containing price and size decimal places
 */
function analyzeOrderBookPrecision(
  bids: Array<{ px: string; sz: string }>,
  asks: Array<{ px: string; sz: string }>,
): {
  priceDecimals: number;
  sizeDecimals: number;
} {
  // Take first 2 levels from each side (up to 4 total)
  const bidSample = bids.slice(0, 2);
  const askSample = asks.slice(0, 2);
  const allSamples = [...bidSample, ...askSample];

  if (allSamples.length === 0) {
    return { priceDecimals: 2, sizeDecimals: 4 }; // Default fallback
  }

  // Extract px and sz values
  const priceValues = allSamples.map((level) => level.px);
  const sizeValues = allSamples.map((level) => level.sz);

  // Analyze decimal places for each type
  const priceDecimals = getMostFrequentDecimalPlaces(priceValues);
  const sizeDecimals = getMostFrequentDecimalPlaces(sizeValues);

  return {
    priceDecimals,
    sizeDecimals,
  };
}

/**
 * Calculate bid-ask spread percentage
 *
 * Formula: ((bestAsk - bestBid) / midPrice) * 100
 *
 * @param bestBid - Best bid price
 * @param bestAsk - Best ask price
 * @returns Formatted spread percentage string (e.g., "0.025%")
 */
function calculateSpreadPercentage(
  bestBid: string | number,
  bestAsk: string | number,
): string {
  const bestBidBN = new BigNumber(bestBid);
  const bestAskBN = new BigNumber(bestAsk);

  if (
    bestBidBN.isZero() ||
    bestAskBN.isZero() ||
    !bestBidBN.isFinite() ||
    !bestAskBN.isFinite()
  ) {
    return '0.000%';
  }

  // Ensure ask >= bid to avoid negative spreads
  if (bestAskBN.isLessThan(bestBidBN)) {
    return '0.000%';
  }

  const spread = bestAskBN.minus(bestBidBN);
  const midPrice = bestBidBN.plus(bestAskBN).dividedBy(2);

  if (midPrice.isZero()) {
    return '0.000%';
  }

  const spreadPercentage = spread.dividedBy(midPrice).multipliedBy(100);

  return `${spreadPercentage.toFixed(3)}%`;
}

/**
 * Format value to specified decimal places using BigNumber precision
 *
 * @param roundingMode Optional rounding mode (default: BigNumber.ROUND_HALF_UP).
 *   For HyperLiquid wire-safe size/price formatting, prefer BigNumber.ROUND_DOWN
 *   (or use {@link formatHlSize} / {@link formatHlPrice}).
 */
function formatWithPrecision(
  value: string | number | BigNumber,
  decimals: number,
  removeTrailingZeros = false,
  roundingMode: BigNumber.RoundingMode = BigNumber.ROUND_HALF_UP,
): string {
  const bn = value instanceof BigNumber ? value : new BigNumber(value);
  if (!bn.isFinite()) return '0';
  if (removeTrailingZeros) {
    return bn.isInteger()
      ? bn.toFixed(0)
      : bn
          .toFixed(decimals, roundingMode)
          .replace(/(\.\d*?)0+$/, '$1')
          .replace(/\.$/, '');
  }
  return bn.toFixed(decimals, roundingMode);
}

/**
 * Strip a decimal-style string to canonical form.
 * Mirrors the helper used by @nktkas/hyperliquid SDK so we stay 1:1 with HL rules
 * without taking a runtime dependency on the SDK.
 */
function _stripDecimalString(value: string): string {
  return value
    .trim()
    .replace(/^(-?)0+(?=\d)/, '$1') // "00123" → "123"
    .replace(/\.0*$|(\.\d+?)0+$/, '$1') // "1.2000" → "1.2"
    .replace(/^(-?)\./, '$10.') // ".5" → "0.5"
    .replace(/^-?$/, '0') // "" → "0"
    .replace(/^-0$/, '0'); // "-0" → "0"
}

/**
 * Truncate a numeric string to N decimal places (regex-based, no float drift).
 * Equivalent to floor() for non-negative values.
 */
function _truncateToDecimals(value: string, decimals: number): string {
  if (decimals < 0) return '0';
  const re = new RegExp(`^-?(?:\\d+)?(?:\\.\\d{0,${decimals}})?`);
  const matched = value.match(re)?.[0];
  if (!matched) return '0';
  return _stripDecimalString(matched);
}

/**
 * Floor-truncate a numeric string to N significant figures.
 * Used to enforce HyperLiquid's "max 5 significant figures" price rule.
 */
function _truncateToSigFigs(value: string, sig: number): string {
  if (sig < 1) return '0';
  if (/^-?0+(\.0*)?$/.test(value)) return '0';

  const neg = value.startsWith('-');
  const abs = neg ? value.slice(1) : value;
  const [intRaw, decRaw = ''] = abs.split('.');
  const int = intRaw || '0';

  // Compute floor(log10(abs)) without Number conversion (preserves precision).
  let magnitude: number;
  if (int !== '0') {
    magnitude = int.replace(/^0+/, '').length - 1;
  } else {
    const leadingZeros = decRaw.match(/^0*/)?.[0].length ?? 0;
    magnitude = -(leadingZeros + 1);
  }

  // Total available significant digits in the input
  const allSigDigits = (int.replace(/^0+/, '') + decRaw).replace(/^0+/, '');
  if (allSigDigits.length <= sig) return _stripDecimalString(value);

  // Take first `sig` significant digits, pad with zeros up to magnitude+1 length on int side.
  const truncatedSig = allSigDigits.slice(0, sig);
  // Reconstruct number: place decimal point so MSD is at 10^magnitude
  let resultStr: string;
  if (magnitude >= sig - 1) {
    // Pure integer with trailing zeros
    resultStr = truncatedSig + '0'.repeat(magnitude - sig + 1);
  } else if (magnitude >= 0) {
    // Has both integer and decimal parts
    const intLen = magnitude + 1;
    resultStr = `${truncatedSig.slice(0, intLen)}.${truncatedSig.slice(intLen)}`;
  } else {
    // < 1, need leading zeros
    const leadingZeros = -magnitude - 1;
    resultStr = `0.${'0'.repeat(leadingZeros)}${truncatedSig}`;
  }
  return _stripDecimalString((neg ? '-' : '') + resultStr);
}

/**
 * Format a size value into a HyperLiquid wire-safe string.
 *
 * Per {@link https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/tick-and-lot-size HL tick & lot size}:
 * - Size is truncated (floor) to `szDecimals` decimal places.
 * - Trailing zeros stripped.
 *
 * Returns '' if the size truncates to 0 (caller should treat as "size too small").
 */
function formatHlSize(size: BigNumber.Value, szDecimals: number): string {
  const bn = size instanceof BigNumber ? size : new BigNumber(size);
  if (!bn.isFinite() || bn.lte(0)) return '';
  const out = _truncateToDecimals(bn.toFixed(), Math.max(0, szDecimals));
  return out === '0' ? '' : out;
}

/**
 * Format a price value into a HyperLiquid wire-safe string.
 *
 * Per {@link https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/tick-and-lot-size HL tick & lot size}:
 * - Max 5 significant figures (integer prices are always allowed regardless).
 * - Max decimals = (perp ? 6 : 8) - szDecimals.
 *
 * Returns '' if the price truncates to 0.
 */
function formatHlPrice(
  price: BigNumber.Value,
  szDecimals: number,
  type: 'perp' | 'spot' = 'perp',
): string {
  const bn = price instanceof BigNumber ? price : new BigNumber(price);
  if (!bn.isFinite() || bn.lte(0)) return '';
  const s = bn.toFixed();
  // Integer prices are always valid regardless of significant figures
  if (/^-?\d+$/.test(s)) return _stripDecimalString(s);
  const maxDecimals = Math.max((type === 'perp' ? 6 : 8) - szDecimals, 0);
  let r = _truncateToDecimals(s, maxDecimals);
  if (!r.includes('.')) return r === '0' ? '' : r;
  const [integerPart] = r.split('.');
  const integerDigits = integerPart.replace(/^-?0+/, '').length;
  if (integerDigits >= MAX_SIGNIFICANT_FIGURES) {
    return _stripDecimalString(integerPart);
  }
  r = _truncateToSigFigs(r, MAX_SIGNIFICANT_FIGURES);
  return r === '0' ? '' : r;
}

/**
 * Validate size input based on szDecimals constraint
 *
 * Validates that the input string represents a valid number with appropriate
 * decimal precision based on the szDecimals parameter.
 *
 * @param input - The input string to validate
 * @param szDecimals - Maximum decimal places allowed for this asset
 * @returns True if input is valid, false otherwise
 */
function validateSizeInput(input: string, szDecimals: number): boolean {
  if (!input) return true;
  if (input === '00') return false;

  // Prevent leading zeros like "01", "001" but allow "0", "0.", "0.1"
  if (input.length > 1 && input[0] === '0' && input[1] !== '.') {
    return false;
  }

  if (szDecimals === 0) return /^[0-9]*$/.test(input);
  if (!/^[0-9]*\.?[0-9]*$/.test(input)) return false;

  const [integerPart, dec = ''] = input.split('.');
  if (integerPart.length > 12) return false;
  return dec.length <= szDecimals;
}

/**
 * Format percentage value with appropriate precision
 *
 * Rounds percentage to 2 decimal places and removes trailing zeros
 * to provide clean percentage display.
 *
 * @param percent - The percentage value to format
 * @returns Formatted percentage string without trailing zeros
 */
function formatPercentage(percent: number): string {
  if (!percent || Number.isNaN(percent)) return '0';

  const roundedBN = new BigNumber(percent)
    .multipliedBy(100)
    .integerValue(BigNumber.ROUND_HALF_UP)
    .dividedBy(100);
  if (roundedBN.isInteger()) {
    return roundedBN.toFixed();
  }
  return roundedBN.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Validate price input with significant digits and precision constraints
 *
 * Validates price input according to HyperLiquid rules:
 * 1. Maximum 5 significant digits
 * 2. Decimal places limited by (MAX_DECIMALS_PERP - szDecimals)
 * 3. If integer part >= 5 digits, no decimals allowed
 *
 * @param input - The price input string to validate
 * @param szDecimals - Asset's szDecimals value (default: 2)
 * @returns True if input is valid according to trading rules
 */
function validatePriceInput(input: string, szDecimals = 2): boolean {
  if (!input) return true;

  const text = input.replace(/。/g, '.');
  if (text === '00') return false;

  // Prevent leading zeros like "01", "001" but allow "0", "0.", "0.1"
  if (text.length > 1 && text[0] === '0' && text[1] !== '.') {
    return false;
  }

  const maxDecimals = MAX_DECIMALS_PERP - szDecimals;

  if (!/^[0-9]*\.?[0-9]*$/.test(text) || text.split('.').length > 2)
    return false;
  if (maxDecimals === 0) return !/\./.test(text);

  const [int = '0', dec = ''] = text.split('.');
  if (int.length > MAX_PRICE_INTEGER_DIGITS) return false;
  const hasDecimal = text.includes('.');

  if (dec.length > Math.min(maxDecimals, 6)) return false;

  const intLen = int.replace(/^0+/, '').length;
  const isZeroInt = intLen === 0;

  if (intLen >= MAX_SIGNIFICANT_FIGURES) return !hasDecimal;

  if (isZeroInt) {
    const leadingZeros = dec.match(/^0*/)?.[0].length || 0;
    return dec.length - leadingZeros <= MAX_SIGNIFICANT_FIGURES;
  }

  return intLen + dec.length <= MAX_SIGNIFICANT_FIGURES;
}

// Spot variant: max decimals = MAX_DECIMALS_SPOT - szDecimals (vs PERP's 6).
function validateSpotPriceInput(input: string, szDecimals = 0): boolean {
  if (!input) return true;

  const text = input.replace(/。/g, '.');
  if (text === '00') return false;

  if (text.length > 1 && text[0] === '0' && text[1] !== '.') {
    return false;
  }

  const maxDecimals = Math.max(0, MAX_DECIMALS_SPOT - szDecimals);

  if (!/^[0-9]*\.?[0-9]*$/.test(text) || text.split('.').length > 2)
    return false;
  if (maxDecimals <= 0) return !/\./.test(text);

  const [int = '0', dec = ''] = text.split('.');
  if (int.length > MAX_PRICE_INTEGER_DIGITS) return false;
  const hasDecimal = text.includes('.');

  if (dec.length > maxDecimals) return false;

  const intLen = int.replace(/^0+/, '').length;
  const isZeroInt = intLen === 0;

  if (intLen >= MAX_SIGNIFICANT_FIGURES) return !hasDecimal;

  if (isZeroInt) {
    const leadingZeros = dec.match(/^0*/)?.[0].length || 0;
    return dec.length - leadingZeros <= MAX_SIGNIFICANT_FIGURES;
  }

  return intLen + dec.length <= MAX_SIGNIFICANT_FIGURES;
}

/**
 * Format price to display with significant digits and precision constraints
 *
 * Formats price according to HyperLiquid display rules:
 * 1. Apply 5 significant digits first
 * 2. Apply precision limit based on szDecimals if provided
 * 3. Remove trailing zeros for clean display
 *
 * @param price - The numeric price to format
 * @param szDecimals - Optional asset's szDecimals for precision limiting
 * @returns Formatted price string suitable for display
 */
/**
 * Get valid decimal places for a spot price
 *
 * HyperLiquid spot prices follow: maxDecimals = MAX_DECIMALS_SPOT - szDecimals
 * with up to MAX_SIGNIFICANT_FIGURES significant figures.
 */
function getValidSpotPriceDecimals(
  marketPrice: string | number,
  szDecimals: number,
): number {
  const validPrice = formatHlPrice(marketPrice, szDecimals, 'spot');
  if (!validPrice) {
    return 2;
  }

  const decimalIndex = validPrice.indexOf('.');
  if (decimalIndex === -1) {
    return 0;
  }

  return validPrice.length - decimalIndex - 1;
}

/**
 * Format a spot price to a valid string according to HyperLiquid rules
 */
function formatSpotPriceToValid(
  marketPrice: string | number,
  szDecimals: number,
): string {
  const price = new BigNumber(marketPrice);

  if (!price.isFinite() || price.isLessThanOrEqualTo(0)) {
    return '0';
  }

  return formatHlPrice(price, szDecimals, 'spot') || '0';
}

function formatPriceToSignificantDigits(
  price: number | string | BigNumber | undefined,
  szDecimals?: number,
): string {
  if (!price) return '0';

  const priceBN = price instanceof BigNumber ? price : new BigNumber(price);

  if (!priceBN.isFinite()) return '0';

  if (priceBN.isInteger()) {
    return priceBN.toFixed();
  }

  // Get string representation for precise digit handling
  const priceStr = priceBN.toFixed(); // Full precision without scientific notation
  const [integerPart, decimalPart = ''] = priceStr.split('.');

  // Calculate integer digits (0 doesn't count as significant)
  const integerDigits = integerPart === '0' ? 0 : integerPart.length;

  let result = priceStr;

  // Apply significant figures rule if there are decimal digits
  if (decimalPart) {
    if (integerDigits >= MAX_SIGNIFICANT_FIGURES) {
      // If integer part already uses all significant figures, remove decimals
      result = integerPart;
    } else {
      // Calculate how many decimal digits we can have for significant figures
      const allowedSigFigDecimals = MAX_SIGNIFICANT_FIGURES - integerDigits;

      // For numbers starting with 0 (like 0.0012345), count leading zeros separately
      // But for numbers with integer part > 0, all decimal digits are significant
      if (integerDigits === 0) {
        // Case: 0.xxxx - leading zeros in decimal part don't count as significant
        const leadingZeroMatch = decimalPart.match(/^(0*)/);
        const leadingZeros = leadingZeroMatch ? leadingZeroMatch[1].length : 0;
        const significantDecimalDigits = decimalPart.substring(leadingZeros);

        if (significantDecimalDigits.length > allowedSigFigDecimals) {
          const truncatedSignificant = significantDecimalDigits.substring(
            0,
            allowedSigFigDecimals,
          );
          result = `${integerPart}.${
            leadingZeros > 0 ? '0'.repeat(leadingZeros) : ''
          }${truncatedSignificant}`;
        }
      } else if (decimalPart.length > allowedSigFigDecimals) {
        // Case: X.decimal where X > 0 - all decimal digits are significant
        const truncatedDecimal = decimalPart.substring(
          0,
          allowedSigFigDecimals,
        );
        result = `${integerPart}.${truncatedDecimal}`;
      }
    }
  }

  // Apply szDecimals limit
  const maxAllowedDecimals =
    szDecimals !== undefined && szDecimals >= 0
      ? MAX_DECIMALS_PERP - szDecimals
      : MAX_DECIMALS_PERP;

  const dotIndex = result.indexOf('.');
  if (dotIndex !== -1) {
    const currentDecimalLength = result.length - dotIndex - 1;
    if (currentDecimalLength > maxAllowedDecimals) {
      result =
        maxAllowedDecimals === 0
          ? result.substring(0, dotIndex)
          : result.substring(0, dotIndex + 1 + maxAllowedDecimals);
    }
  }

  // Always remove trailing zeros (this preserves middle zeros but removes end zeros)
  if (result.includes('.')) {
    result = result.replace(/\.?0+$/, '');
  }

  return result;
}

/**
 * Find the margin tier based on total value
 */
function findMarginTier(
  totalValue: BigNumber,
  marginTiers: IMarginTier[],
): IMarginTier | null {
  if (!marginTiers.length) return null;

  const sortedTiers = marginTiers.toReversed();
  for (const tier of sortedTiers) {
    if (totalValue.gte(new BigNumber(tier.lowerBound))) {
      return tier;
    }
  }
  return null;
}

// Inline simple calculations to reduce function call overhead

/**
 * Core liquidation price calculation formula
 * Formula: Price - side * Margin_Available / Position_Size / (1 - mmr * side)
 */
function calculateLiquidationPriceCore(
  entryPrice: BigNumber,
  marginAvailable: BigNumber,
  positionSize: BigNumber,
  mmr: BigNumber,
  side: 'long' | 'short',
): BigNumber {
  const sideMultiplier = side === 'long' ? '1' : '-1';
  return entryPrice.minus(
    new BigNumber(sideMultiplier)
      .multipliedBy(marginAvailable)
      .dividedBy(positionSize)
      .dividedBy(new BigNumber('1').minus(mmr.multipliedBy(sideMultiplier))),
  );
}

/**
 * Combine existing position with new order
 */
function combinePositionWithOrder(
  params: ICombinePositionParams,
): ICombinePositionResult {
  const {
    existingPositionSize,
    existingEntryPrice,
    newOrderSize,
    newOrderSide,
    newOrderPrice,
  } = params;

  const newOrderSideMultiplier = newOrderSide === 'long' ? 1 : -1;
  const signedNewOrderSize = newOrderSize.multipliedBy(newOrderSideMultiplier);
  const resultingSignedSize = existingPositionSize.plus(signedNewOrderSize);

  // Complete closure
  if (resultingSignedSize.isZero()) {
    return {
      finalSize: new BigNumber(0),
      finalSide: 'long',
      finalEntryPrice: newOrderPrice,
      isEmpty: true,
    };
  }

  const resultingSide = resultingSignedSize.gt(0) ? 'long' : 'short';
  const resultingSize = resultingSignedSize.abs();
  const existingSide = existingPositionSize.gt(0) ? 'long' : 'short';
  const existingSize = existingPositionSize.abs();

  // Same direction: weighted average
  if (existingSide === newOrderSide) {
    const existingValue = existingSize.multipliedBy(existingEntryPrice);
    const newOrderValue = newOrderSize.multipliedBy(newOrderPrice);
    const combinedValue = existingValue.plus(newOrderValue);
    const weightedAvgPrice = combinedValue.dividedBy(
      existingSize.plus(newOrderSize),
    );

    return {
      finalSize: resultingSize,
      finalSide: resultingSide,
      finalEntryPrice: weightedAvgPrice,
      isEmpty: false,
    };
  }

  // Opposite direction: partial close or flip
  if (newOrderSize.lt(existingSize)) {
    // Partial close: entry price unchanged
    return {
      finalSize: resultingSize,
      finalSide: resultingSide,
      finalEntryPrice: existingEntryPrice,
      isEmpty: false,
    };
  }

  // Flip: new direction entry price
  return {
    finalSize: resultingSize,
    finalSide: resultingSide,
    finalEntryPrice: newOrderPrice,
    isEmpty: false,
  };
}

/**
 * Calculate profit/loss for a position
 *
 * Formula: (exitPrice - entryPrice) * side * amount
 * - For long positions: profit when exitPrice > entryPrice
 * - For short positions: profit when exitPrice < entryPrice
 *
 * @param params - Profit/loss calculation parameters
 * @returns Formatted profit/loss string with currency symbol
 */
function calculateProfitLoss(params: IProfitLossParams): string {
  const { entryPrice, exitPrice, amount, side, formatOptions = {} } = params;

  const { currency = '', decimals = 2, showSign = true } = formatOptions;

  // Convert all inputs to BigNumber for precision
  const entryPriceBN = new BigNumber(entryPrice);
  const exitPriceBN = new BigNumber(exitPrice);
  const amountBN = new BigNumber(amount);

  // Validate inputs
  if (
    !entryPriceBN.isFinite() ||
    !exitPriceBN.isFinite() ||
    !amountBN.isFinite() ||
    entryPriceBN.isZero() ||
    amountBN.isZero()
  ) {
    return `${currency}0.${'0'.repeat(decimals)}`;
  }

  // Calculate profit: (exitPrice - entryPrice) * sideMultiplier * amount
  const sideMultiplier = side === 'long' ? 1 : -1;
  const profit = exitPriceBN
    .minus(entryPriceBN)
    .multipliedBy(sideMultiplier)
    .multipliedBy(amountBN);

  // Format result
  const isNegative = profit.lt(0);
  const absProfit = profit.abs();
  const formattedAmount = absProfit.toFixed(decimals);

  if (showSign) {
    const sign = isNegative ? '-' : '';
    return `${sign}${currency}${formattedAmount}`;
  }

  return isNegative
    ? `-${currency}${formattedAmount}`
    : `${currency}${formattedAmount}`;
}

/**
 * Unified liquidation price calculation with optional existing position
 * Automatically chooses optimal calculation path based on position existence
 */
function calculateLiquidationPrice(
  params: ILiquidationPriceParams & {
    // Optional existing position parameters
    existingPositionSize?: BigNumber;
    existingEntryPrice?: BigNumber;
    newOrderSide?: 'long' | 'short';
  },
): BigNumber | null {
  const {
    totalValue,
    referencePrice,
    markPrice,
    clampToCurrentMark = true,
    positionSize,
    side,
    leverage,
    maxLeverage,
    mode,
    marginTiers,
    crossMarginUsed = new BigNumber(0),
    crossMaintenanceMarginUsed = new BigNumber(0),
    existingPositionSize,
    existingEntryPrice,
    newOrderSide,
  } = params;

  if (positionSize.isZero()) return null;

  let effectivePrice = referencePrice;
  if (markPrice && clampToCurrentMark) {
    const _side = newOrderSide || side;
    if (_side === 'long') {
      // Long: if limit price > mark price, will execute at market price
      effectivePrice = referencePrice.gt(markPrice)
        ? markPrice
        : referencePrice;
    } else {
      // Short: if limit price < mark price, will execute at market price
      effectivePrice = referencePrice.lt(markPrice)
        ? markPrice
        : referencePrice;
    }
  }

  // Recalculate totalValue with effectivePrice if it differs from referencePrice
  // This ensures consistency when limit orders would execute at market price
  const adjustedTotalValue = effectivePrice.isEqualTo(referencePrice)
    ? totalValue
    : positionSize.multipliedBy(effectivePrice);

  // Check if we need to consider existing position
  const hasExistingPosition =
    existingPositionSize &&
    existingEntryPrice &&
    newOrderSide &&
    !existingPositionSize.isZero();

  if (hasExistingPosition) {
    // Calculate existing position metrics
    // IMPORTANT: Use current mark price for maintenance margin calculation, not entry price
    // Maintenance margin is based on position's current market value, not entry value
    const existingPositionValue = existingPositionSize
      .abs()
      .multipliedBy(effectivePrice);
    const existingMarginTier = findMarginTier(
      existingPositionValue,
      marginTiers || [],
    );
    const existingMMR = new BigNumber(1)
      .dividedBy(existingMarginTier?.maxLeverage || maxLeverage)
      .dividedBy(2);
    const existingMaintenanceMarginRequired =
      existingPositionValue.multipliedBy(existingMMR);

    // Combine positions
    const combinedPosition = combinePositionWithOrder({
      existingPositionSize,
      existingEntryPrice,
      newOrderSize: positionSize,
      newOrderSide,
      newOrderPrice: effectivePrice,
    });

    // Complete closure means no liquidation price
    if (combinedPosition.isEmpty) return null;

    // Calculate combined position metrics
    const combinedPositionValue =
      combinedPosition.finalSize.multipliedBy(effectivePrice);
    const combinedMarginTier = findMarginTier(
      combinedPositionValue,
      marginTiers || [],
    );
    const combinedMMR = new BigNumber(1)
      .dividedBy(combinedMarginTier?.maxLeverage || maxLeverage)
      .dividedBy(2);
    const combinedMaintenanceMarginRequired =
      combinedPositionValue.multipliedBy(combinedMMR);

    // Calculate margin available based on mode
    const marginAvailable =
      mode === 'isolated'
        ? combinedPositionValue
            .dividedBy(leverage)
            .minus(combinedMaintenanceMarginRequired)
        : crossMarginUsed
            .plus(existingMaintenanceMarginRequired)
            .minus(combinedMaintenanceMarginRequired)
            .minus(crossMaintenanceMarginUsed);

    return calculateLiquidationPriceCore(
      combinedPosition.finalEntryPrice,
      marginAvailable,
      combinedPosition.finalSize,
      combinedMMR,
      combinedPosition.finalSide,
    );
  }

  // Simple case without existing position
  const marginTier = findMarginTier(adjustedTotalValue, marginTiers || []);
  const mmr = new BigNumber(1)
    .dividedBy(marginTier?.maxLeverage || maxLeverage)
    .dividedBy(2);
  const maintenanceMarginRequired = adjustedTotalValue.multipliedBy(mmr);

  const marginAvailable =
    mode === 'isolated'
      ? adjustedTotalValue.dividedBy(leverage).minus(maintenanceMarginRequired)
      : crossMarginUsed
          .minus(maintenanceMarginRequired)
          .minus(crossMaintenanceMarginUsed);

  return calculateLiquidationPriceCore(
    effectivePrice,
    marginAvailable,
    positionSize,
    mmr,
    side,
  );
}

function formatAssetCtx(
  assetCtx: IWsActiveAssetCtx['ctx'] | null,
): IPerpsFormattedAssetCtx {
  const midPrice = assetCtx?.midPx || '0';
  const ctx: IPerpsFormattedAssetCtx = {
    midPrice,
    lastPrice: midPrice,
    markPrice: assetCtx?.markPx || '0', // indexPrice
    oraclePrice: assetCtx?.oraclePx || '0',
    prevDayPrice: assetCtx?.prevDayPx || '0', // ctx.prevDayPx || markPrice;
    fundingRate: assetCtx?.funding || '0', // funding8h
    openInterest: assetCtx?.openInterest || '0',
    volume24h: assetCtx?.dayNtlVlm || '0',
    change24h: '0',
    change24hPercent: 0,
  };
  const priceDecimals = getValidPriceDecimals(ctx.markPrice);

  const markPriceBN = new BigNumber(ctx.markPrice);
  const prevDayPriceBN = new BigNumber(ctx.prevDayPrice);
  const change24hBN = markPriceBN.minus(prevDayPriceBN);

  const change24h = change24hBN.toFixed(priceDecimals);
  const change24hPercent = prevDayPriceBN.isZero()
    ? 0
    : change24hBN.dividedBy(prevDayPriceBN).multipliedBy(100).toNumber();

  ctx.change24h = change24h;
  ctx.change24hPercent = change24hPercent;

  return ctx;
}

function formatLargeNumber(
  value: string | number | undefined | null,
  decimals = 2,
): string {
  if (value === null || value === undefined) return '0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(num) || num === null || num === undefined) return '0';

  if (num >= 1e12) {
    return `${(num / 1e12).toFixed(decimals)}T`;
  }
  if (num >= 1e9) {
    return `${(num / 1e9).toFixed(decimals)}B`;
  }
  if (num >= 1e6) {
    return `${(num / 1e6).toFixed(decimals)}M`;
  }
  if (num >= 1e3) {
    return `${(num / 1e3).toFixed(decimals)}K`;
  }

  // For smaller numbers, show more precision
  if (num >= 1) {
    return num.toFixed(decimals);
  }
  if (num >= 0.01) {
    return num.toFixed(decimals);
  }
  // For very small numbers, use more decimal places
  return num.toFixed(6);
}

interface ITradingSizeContext {
  side: 'long' | 'short';
  price?: string;
  markPrice?: string;
  availableToTrade?: Array<number | string>;
  maxTradeSzs?: Array<number | string>;
  leverageValue?: number | string | null;
  fallbackLeverage?: number | string | null;
  szDecimals?: number;
}

interface ITradingSizeParams extends ITradingSizeContext {
  sizeInputMode: EPerpsSizeInputMode;
  manualSize?: string;
  sizePercent?: number;
}

const computeEffectivePrice = (
  price?: string,
  markPrice?: string,
): BigNumber | null => {
  if (price) {
    const priceBN = new BigNumber(price);
    if (priceBN.isFinite() && priceBN.gt(0)) {
      return priceBN;
    }
  }

  if (markPrice) {
    const markPriceBN = new BigNumber(markPrice);
    if (markPriceBN.isFinite() && markPriceBN.gt(0)) {
      return markPriceBN;
    }
  }

  return null;
};

const sanitizeManualSize = (size?: string): string => {
  const trimmed = size?.trim();
  if (!trimmed || trimmed === '.' || trimmed === '-') {
    return '0';
  }
  return trimmed;
};

const computeMaxTradeSize = ({
  side,
  price,
  markPrice,
  maxTradeSzs,
  leverageValue,
  fallbackLeverage,
  szDecimals,
}: ITradingSizeContext): BigNumber => {
  const effectivePrice = computeEffectivePrice(price, markPrice);
  if (!effectivePrice) {
    return new BigNumber(0);
  }

  const leverageCandidate = leverageValue ?? fallbackLeverage ?? 1;
  const leverageBN = new BigNumber(leverageCandidate);
  const leverageSafe =
    leverageBN.isFinite() && leverageBN.gt(0) ? leverageBN : new BigNumber(1);

  const index = side === 'long' ? 0 : 1;
  const maxTradeSz = new BigNumber(maxTradeSzs?.[index] ?? 0);
  const markPriceBN = new BigNumber(markPrice ?? 0);

  if (!maxTradeSz.gt(0) || !markPriceBN.gt(0)) {
    return new BigNumber(0);
  }

  // availableMargin = maxTradeSzs[side] * markPx / leverage
  const availableMargin = maxTradeSz
    .multipliedBy(markPriceBN)
    .dividedBy(leverageSafe);

  // maxTokens = availableMargin * leverage / effectivePrice
  const maxTokens = availableMargin
    .multipliedBy(leverageSafe)
    .dividedBy(effectivePrice);

  if (!maxTokens.isFinite() || maxTokens.lte(0)) {
    return new BigNumber(0);
  }

  const decimals = szDecimals ?? 2;
  return maxTokens.decimalPlaces(decimals, BigNumber.ROUND_FLOOR);
};

const resolveTradingSizeBN = ({
  sizeInputMode,
  manualSize,
  sizePercent,
  side,
  price,
  markPrice,
  maxTradeSzs,
  leverageValue,
  fallbackLeverage,
  szDecimals,
}: ITradingSizeParams): BigNumber => {
  if (sizeInputMode !== 'slider') {
    const sanitized = sanitizeManualSize(manualSize);
    const manualBN = new BigNumber(sanitized);
    return manualBN.isFinite() && manualBN.gte(0) ? manualBN : new BigNumber(0);
  }

  const percentValue = Number.isFinite(sizePercent)
    ? Math.max(0, Math.min(100, sizePercent ?? 0))
    : 0;

  if (percentValue <= 0) {
    return new BigNumber(0);
  }

  const maxSize = computeMaxTradeSize({
    side,
    price,
    markPrice,
    maxTradeSzs,
    leverageValue,
    fallbackLeverage,
    szDecimals,
  });

  if (!maxSize.isFinite() || maxSize.lte(0)) {
    return new BigNumber(0);
  }

  const percentBN = new BigNumber(percentValue);
  const decimals = szDecimals ?? 2;
  return maxSize
    .multipliedBy(percentBN)
    .dividedBy(100)
    .decimalPlaces(decimals, BigNumber.ROUND_FLOOR);
};

const resolveTradingSize = (params: ITradingSizeParams): string => {
  const sizeBN = resolveTradingSizeBN(params);
  if (!sizeBN.isFinite() || sizeBN.lte(0)) {
    return '0';
  }
  return sizeBN.toFixed();
};

/**
 * Sort perps assets by various fields
 * Pre-converts numeric values to avoid repeated conversions during sorting
 * If sortField is empty, returns original order (no sorting)
 */
export function sortPerpsAssetIndices({
  assets,
  assetCtxs,
  sortField,
  sortDirection,
}: {
  assets: IPerpsUniverse[];
  assetCtxs: Record<number, IPerpsAssetCtx>;
  sortField: IPerpTokenSortField | '';
  sortDirection: IPerpTokenSortDirection;
}): number[] {
  if (!assets.length) {
    return [];
  }

  // No sorting - preserve original order
  if (!sortField) {
    return assets.map((_, index) => index);
  }

  const indicesWithData = assets.map((asset, index) => {
    const rawCtx = assetCtxs[asset.assetId];

    const markPrice = Number(rawCtx?.markPx || 0);
    const fundingRate = Number(rawCtx?.funding || 0);
    const volume24h = Number(rawCtx?.dayNtlVlm || 0);
    const openInterest = Number(rawCtx?.openInterest || 0);
    const prevDayPx = Number(rawCtx?.prevDayPx || 0);
    const change24hPercent =
      prevDayPx > 0 ? ((markPrice - prevDayPx) / prevDayPx) * 100 : 0;
    const openInterestValue = openInterest * markPrice;

    return {
      index,
      asset,
      markPrice,
      fundingRate,
      volume24h,
      openInterest,
      openInterestValue,
      change24hPercent,
    };
  });

  indicesWithData.sort((a, b) => {
    let compareResult = 0;

    switch (sortField) {
      case 'name':
        compareResult = a.asset.name.localeCompare(b.asset.name, undefined, {
          sensitivity: 'base',
        });
        break;

      case 'markPrice':
        compareResult = a.markPrice - b.markPrice;
        break;

      case 'change24hPercent':
        compareResult = a.change24hPercent - b.change24hPercent;
        break;

      case 'fundingRate':
        compareResult = a.fundingRate - b.fundingRate;
        break;

      case 'volume24h':
        compareResult = a.volume24h - b.volume24h;
        break;

      case 'openInterest':
        compareResult = a.openInterestValue - b.openInterestValue;
        break;

      default:
        break;
    }

    return sortDirection === 'asc' ? compareResult : -compareResult;
  });

  return indicesWithData.map((item) => item.index);
}

// ── Standalone Trigger Order Utilities ──

/**
 * Map trigger order type to HyperLiquid `isMarket` field.
 *
 * - `isMarket: true` for market triggers, `false` for limit triggers
 */
function mapTriggerOrderType(triggerOrderType: ETriggerOrderType): {
  isMarket: boolean;
} {
  switch (triggerOrderType) {
    case ETriggerOrderType.TRIGGER_MARKET:
      return { isMarket: true };
    case ETriggerOrderType.TRIGGER_LIMIT:
      return { isMarket: false };
    default: {
      const _exhaustive: never = triggerOrderType;
      throw new OneKeyLocalError(
        `Unknown trigger order type: ${String(_exhaustive)}`,
      );
    }
  }
}

/**
 * Infer TP/SL direction from side, triggerPrice, and currentPrice.
 *
 * HL API tpsl semantics (standalone trigger orders):
 * - tpsl='sl': buy triggers when price rises above triggerPx; sell triggers when price drops below
 * - tpsl='tp': buy triggers when price drops below triggerPx; sell triggers when price rises above
 *
 * So for order side:
 * - Long (buy) + trigger > current → 'sl' (buy stop: triggers on price rise)
 * - Long (buy) + trigger < current → 'tp' (buy TP: triggers on price drop)
 * - Short (sell) + trigger > current → 'tp' (sell TP: triggers on price rise)
 * - Short (sell) + trigger < current → 'sl' (sell stop: triggers on price drop)
 */
function inferTpsl(params: {
  side: 'long' | 'short';
  triggerPrice: BigNumber;
  currentPrice: BigNumber;
}): 'tp' | 'sl' {
  const { side, triggerPrice, currentPrice } = params;
  const isAbove = triggerPrice.gt(currentPrice);
  if (side === 'long') {
    return isAbove ? 'sl' : 'tp';
  }
  return isAbove ? 'tp' : 'sl';
}

/**
 * Get the effective price used for size/margin calculations in trigger mode.
 *
 * - Market trigger: uses triggerPrice (the price at which the order activates)
 * - Limit trigger: uses executionPrice (the limit price for the resulting order)
 * - Fallback: uses midPrice
 */
function getTriggerEffectivePrice(params: {
  triggerOrderType: ETriggerOrderType;
  triggerPrice?: string;
  executionPrice?: string;
  midPrice?: string;
}): BigNumber {
  const { triggerOrderType, triggerPrice, executionPrice, midPrice } = params;

  const isLimitTrigger = triggerOrderType === ETriggerOrderType.TRIGGER_LIMIT;

  if (isLimitTrigger && executionPrice) {
    const execBN = new BigNumber(executionPrice);
    if (execBN.isFinite() && execBN.gt(0)) {
      return execBN;
    }
  }

  if (triggerPrice) {
    const trigBN = new BigNumber(triggerPrice);
    if (trigBN.isFinite() && trigBN.gt(0)) {
      return trigBN;
    }
  }

  if (midPrice) {
    const midBN = new BigNumber(midPrice);
    if (midBN.isFinite() && midBN.gt(0)) {
      return midBN;
    }
  }

  return new BigNumber(0);
}

export function parseSignatureToRSV(signatureHex: string): {
  r: string;
  s: string;
  v: number;
} {
  const cleanSig = signatureHex.replace(/^0x/, '');
  return {
    r: `0x${cleanSig.slice(0, 64)}`,
    s: `0x${cleanSig.slice(64, 128)}`,
    v: parseInt(cleanSig.slice(128, 130), 16),
  };
}

// Parse coin with dex prefix, e.g., "xyz:NVDA" -> { displayName: "NVDA", dexLabel: "xyz" }
export function parseDexCoin(coin: string): {
  displayName: string;
  dexLabel?: string;
} {
  if (coin.includes(':')) {
    const [dexLabel, name] = coin.split(':', 2);
    const displayName = name || coin;
    return {
      displayName,
      dexLabel: dexLabel || undefined,
    };
  }
  return {
    displayName: coin,
    dexLabel: undefined,
  };
}

export interface ITokenSearchAliasItem {
  subtitle?: string;
  aliases: string[];
}

export type ITokenSearchAliases = Record<string, ITokenSearchAliasItem>;

/**
 * Find token symbols by search alias
 * @param query - Search query (already lowercased)
 * @param serverAliases - Server-provided aliases
 * @returns Matched symbol list
 */
export function findTokensByAlias(
  query: string,
  serverAliases?: ITokenSearchAliases,
): string[] {
  if (!serverAliases || Object.keys(serverAliases).length === 0) {
    return [];
  }

  return Object.entries(serverAliases)
    .filter(([, item]) =>
      item.aliases?.some((alias) => alias.toLowerCase().includes(query)),
    )
    .map(([symbol]) => symbol);
}

export function getTokenSubtitle(
  tokenName: string,
  serverAliases?: ITokenSearchAliases,
): string | undefined {
  return serverAliases?.[tokenName]?.subtitle;
}

// ─── Shared formatting utilities for Perps UI ──────────────────────────────

/**
 * Format a number as USD string using numberFormat 'value' formatter.
 * Optionally shows +/- sign for non-zero values.
 */
export function formatPerpsUsd(
  value: number | null | undefined,
  showSign = false,
): string {
  if (value === null || value === undefined) return '--';
  const bn = new BigNumber(value);
  const abs = bn.abs().toFixed();
  const formatted = numberFormat(abs, {
    formatter: 'value',
    formatterOptions: { currency: '$' },
  });
  if (showSign && !bn.isZero()) {
    return bn.lt(0) ? `-${formatted}` : `+${formatted}`;
  }
  if (bn.lt(0)) {
    return `-${formatted}`;
  }
  return formatted;
}

/**
 * Format a number as compact USD (K/M/B suffixes) using numberFormat 'marketCap' formatter.
 */
export function formatPerpsCompactUsd(value: number): string {
  if (value === 0) return '$0';
  const bn = new BigNumber(value);
  const abs = bn.abs().toFixed();
  const formatted = numberFormat(abs, {
    formatter: 'marketCap',
    formatterOptions: { currency: '$' },
  });
  if (bn.lt(0)) {
    return `-${formatted}`;
  }
  return formatted;
}

/**
 * Return a theme color token based on PnL sign.
 * Positive → '$green11', Negative → '$red11', Zero/null → '$text'.
 */
type IPerpsValueColor = '$text' | '$green11' | '$red11';

export function getPerpsValueColor(
  value: number | null | undefined,
): IPerpsValueColor {
  if (value === null || value === undefined || value === 0) return '$text';
  return value > 0 ? '$green11' : '$red11';
}

/**
 * Compact USD formatter for chart Y-axis labels (lightweight-charts priceFormatter).
 * Output: "$1.2M", "$45K", "$120", "$3.14" etc.
 *
 * NOTE: Keep in sync with `usdPriceFormatter` in LightweightChart/utils/htmlTemplate.ts
 * (native WebView cannot use TS functions, so the logic is duplicated as inline JS).
 */
export function formatChartUsdPrice(price: number): string {
  const abs = Math.abs(price);
  const sign = price < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1000) {
    return `${sign}$${(abs / 1000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  }
  if (Number.isInteger(abs)) {
    return `${sign}$${abs.toFixed(0)}`;
  }
  return `${sign}$${abs.toFixed(2)}`;
}

// ── Spot Asset Context Formatter ──

function formatSpotAssetCtx(
  spotCtx: ISpotAssetCtx | null,
): ISpotFormattedAssetCtx {
  const midPrice = spotCtx?.midPx || '0';
  const markPrice = spotCtx?.markPx || '0';
  const prevDayPrice = spotCtx?.prevDayPx || '0';
  const priceDecimals = getValidPriceDecimals(markPrice);

  const markPriceBN = new BigNumber(markPrice);
  const prevDayPriceBN = new BigNumber(prevDayPrice);
  const change24hBN = markPriceBN.minus(prevDayPriceBN);

  const change24h = change24hBN.toFixed(priceDecimals);
  const change24hPercent = prevDayPriceBN.isZero()
    ? 0
    : change24hBN.dividedBy(prevDayPriceBN).multipliedBy(100).toNumber();

  return {
    midPrice,
    markPrice,
    prevDayPrice,
    volume24h: spotCtx?.dayNtlVlm || '0',
    change24h,
    change24hPercent,
    circulatingSupply: spotCtx?.circulatingSupply || '0',
    totalSupply: spotCtx?.totalSupply || '0',
    dayBaseVlm: spotCtx?.dayBaseVlm || '0',
  };
}

/** Lightweight price entry formatter for spot price map entries (markPx + prevDayPx). */
function formatSpotPriceEntry(spotEntry?: {
  markPx?: string;
  prevDayPx?: string;
}): { change24hPercent: number; markPrice: string } {
  const markPrice = spotEntry?.markPx ?? '0';
  const markPriceNumber = Number(markPrice);
  const prevDayPriceNumber = Number(spotEntry?.prevDayPx ?? '0');
  const change24hPercent =
    Number.isFinite(prevDayPriceNumber) && prevDayPriceNumber > 0
      ? ((markPriceNumber - prevDayPriceNumber) / prevDayPriceNumber) * 100
      : 0;

  return {
    change24hPercent: Number.isFinite(change24hPercent) ? change24hPercent : 0,
    markPrice,
  };
}

// ── Spot Token Utils ──

/* cspell:disable -- HL spot token internal names (UBTC, HPENGU, FXRP, etc.) */
const SPOT_TOKEN_DISPLAY_MAP: Record<string, string> = {
  UBTC: 'BTC',
  UETH: 'ETH',
  USOL: 'SOL',
  UFART: 'FARTCOIN',
  UBONK: 'BONK',
  UPUMP: 'PUMP',
  UENA: 'ENA',
  UXPL: 'XPL',
  UZEC: 'ZEC',
  UMON: 'MON',
  UUUSPX: 'SPX',
  UDOGE: 'DOGE',
  UMOG: 'MOG',
  UWLD: 'WLD',
  UMEGA: 'MEGA',
  UVIRT: 'VIRTUAL',
  USPYX: 'SPYX',
  UDZ: 'DZ',
  LINK0: 'LINK',
  AAVE0: 'AAVE',
  AVAX0: 'AVAX',
  BNB0: 'BNB',
  CFX0: 'CFX',
  PEPE0: 'PEPE',
  TRX0: 'TRX',
  USDT0: 'USDT',
  XAUT0: 'XAUT',
  HPENGU: 'PENGU',
  HPEPE: 'PEPE',
  FXRP: 'XRP',
  XMR1: 'XMR',
  HBNB: 'BNB',
  HSEI: 'SEI',
};
/* cspell:enable */

function getSpotTokenDisplayName(rawName: string): string {
  return SPOT_TOKEN_DISPLAY_MAP[rawName] ?? rawName;
}

function getHyperliquidTokenImageUrl(tokenSymbol: string): string {
  const normalizedSymbol = getSpotTokenDisplayName(tokenSymbol);
  return `https://uni.onekey-asset.com/static/hyperliquid/${normalizedSymbol}.png`;
}

function formatSpotPairDisplayName(
  baseName: string,
  quoteName: string,
): string {
  return `${getSpotTokenDisplayName(baseName)}/${quoteName}`;
}

function isSpotInstrument(coin?: string | null): boolean {
  if (!coin) return false;
  return coin.startsWith('@') || coin.includes('/');
}

const SPOT_MIN_VOLUME_STRICT = 10;
const SPOT_SELECTOR_MIN_VOLUME = 1000;

function filterSpotTokensStrict(
  tokens: Array<{ dayNtlVlm: number; midPx: boolean }>,
): Array<{ dayNtlVlm: number; midPx: boolean }> {
  return tokens.filter((t) => t.dayNtlVlm >= SPOT_MIN_VOLUME_STRICT && t.midPx);
}

export {
  formatAssetCtx,
  formatLargeNumber,
  MAX_DECIMALS_PERP,
  getValidPriceDecimals,
  getPriceScaleDecimals,
  getDisplayPriceScaleDecimals,
  calculatePriceScale,
  calculateDisplayPriceScale,
  formatPriceToValid,
  analyzeOrderBookPrecision,
  formatWithPrecision,
  countDecimalPlaces,
  getMostFrequentDecimalPlaces,
  calculateSpreadPercentage,
  validateSizeInput,
  formatPercentage,
  validatePriceInput,
  validateSpotPriceInput,
  formatPriceToSignificantDigits,
  calculateProfitLoss,
  findMarginTier,
  calculateLiquidationPrice,
  calculateLiquidationPriceCore,
  combinePositionWithOrder,
  sanitizeManualSize,
  computeMaxTradeSize,
  resolveTradingSize,
  resolveTradingSizeBN,
  getHyperliquidTokenImageUrl,
  mapTriggerOrderType,
  inferTpsl,
  getTriggerEffectivePrice,
  getValidSpotPriceDecimals,
  formatSpotPriceToValid,
  formatSpotAssetCtx,
  formatSpotPriceEntry,
  isSpotInstrument,
  getSpotTokenDisplayName,
  formatSpotPairDisplayName,
  filterSpotTokensStrict,
  SPOT_TOKEN_DISPLAY_MAP,
  SPOT_MIN_VOLUME_STRICT,
  SPOT_SELECTOR_MIN_VOLUME,
  formatHlSize,
  formatHlPrice,
};
export default {
  formatAssetCtx,
  formatLargeNumber,
  MAX_DECIMALS_PERP,
  getValidPriceDecimals,
  getPriceScaleDecimals,
  getDisplayPriceScaleDecimals,
  calculatePriceScale,
  calculateDisplayPriceScale,
  formatPriceToValid,
  analyzeOrderBookPrecision,
  formatWithPrecision,
  countDecimalPlaces,
  getMostFrequentDecimalPlaces,
  calculateSpreadPercentage,
  validateSizeInput,
  formatPercentage,
  validatePriceInput,
  validateSpotPriceInput,
  formatPriceToSignificantDigits,
  calculateProfitLoss,
  findMarginTier,
  calculateLiquidationPrice,
  calculateLiquidationPriceCore,
  combinePositionWithOrder,
  sanitizeManualSize,
  computeMaxTradeSize,
  resolveTradingSize,
  resolveTradingSizeBN,
  parseSignatureToRSV,
  getHyperliquidTokenImageUrl,
  findTokensByAlias,
  getTokenSubtitle,
  mapTriggerOrderType,
  inferTpsl,
  getTriggerEffectivePrice,
  formatPerpsUsd,
  formatPerpsCompactUsd,
  getPerpsValueColor,
  formatChartUsdPrice,
  formatSpotAssetCtx,
  formatSpotPriceEntry,
  isSpotInstrument,
  getSpotTokenDisplayName,
  formatSpotPairDisplayName,
  filterSpotTokensStrict,
  SPOT_TOKEN_DISPLAY_MAP,
  SPOT_MIN_VOLUME_STRICT,
  SPOT_SELECTOR_MIN_VOLUME,
  getValidSpotPriceDecimals,
  formatSpotPriceToValid,
  formatHlSize,
  formatHlPrice,
};
