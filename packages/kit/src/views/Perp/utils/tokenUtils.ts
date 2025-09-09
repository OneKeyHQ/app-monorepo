import { BigNumber } from 'bignumber.js';

export function formatTokenPrice(
  price: string | number,
  priceDecimals: number,
): string {
  if (!price || Number.isNaN(Number(price))) return '0';
  return new BigNumber(price).toFixed(priceDecimals);
}

export function getPriceDecimals(szDecimals: number): number {
  return Math.abs(szDecimals - 5);
}

export function calculateSlippagePrice(
  markPrice: string | number,
  side: 'long' | 'short',
  slippage: number,
  szDecimals: number,
): string {
  const price = new BigNumber(markPrice || 0);
  const slippageDirection = side === 'long' ? 1 : -1;
  const priceWithSlippage = price.multipliedBy(
    1 + slippageDirection * slippage,
  );
  const priceDecimals = getPriceDecimals(szDecimals);
  return formatTokenPrice(priceWithSlippage.toFixed(), priceDecimals);
}

export function validatePricePrecision(
  price: string | number,
  szDecimals: number,
): boolean {
  const priceStr = price.toString();
  const decimalIndex = priceStr.indexOf('.');
  if (decimalIndex === -1) return true;

  const decimalPlaces = priceStr.length - decimalIndex - 1;
  const maxPriceDecimals = getPriceDecimals(szDecimals);
  return decimalPlaces <= maxPriceDecimals;
}

export function getPriceTickSize(szDecimals: number): string {
  const priceDecimals = getPriceDecimals(szDecimals);
  return new BigNumber(10).exponentiatedBy(-priceDecimals).toFixed();
}

export function displayPrice(
  price: string | number,
  szDecimals: number,
): string {
  const priceDecimals = getPriceDecimals(szDecimals);
  return new BigNumber(price || 0).toFormat(priceDecimals);
}

export function validateSizeInput(input: string, szDecimals: number): boolean {
  if (!input) return true;

  // Only allow numbers and decimal point
  if (!/^[0-9]*\.?[0-9]*$/.test(input)) return false;

  const parts = input.split('.');
  if (parts.length > 2) return false; // Multiple decimal points

  // Check decimal places
  if (parts.length === 2) {
    if (szDecimals === 0) return false; // No decimals allowed
    if (parts[1].length > szDecimals) return false; // Too many decimal places
  }

  return true;
}

export function validatePriceInput(
  input: string,
  szDecimals?: number,
): boolean {
  if (!input) return true;

  const processedInput = input.replace(/。/g, '.');

  if (!/^[0-9]*\.?[0-9]*$/.test(processedInput)) return false;

  const parts = processedInput.split('.');
  if (parts.length > 2) return false;

  const integerPart = parts[0] || '';
  const decimalPart = parts.length > 1 ? parts[1] : '';
  const trimmedInteger = integerPart.replace(/^0+/, '') || '0';

  if (parts.length === 2 && decimalPart === '') return true;

  if (szDecimals !== undefined && decimalPart.length > 0) {
    const maxDecimalPlaces = Math.max(0, 6 - szDecimals);
    if (decimalPart.length > maxDecimalPlaces) return false;
  }

  if (parts.length === 1) {
    if (trimmedInteger !== '0' && trimmedInteger.length > 5) return false;
    return true;
  }

  if (
    trimmedInteger.length >= 5 &&
    trimmedInteger !== '0' &&
    decimalPart.length > 0
  )
    return false;

  if (decimalPart.length > 0) {
    const integerDigits = trimmedInteger === '0' ? 0 : trimmedInteger.length;
    const decimalDigits = decimalPart.length;

    if (integerDigits === 0) {
      const leadingZeros = decimalPart.match(/^0*/)?.[0].length || 0;
      const significantDecimalDigits = decimalPart.length - leadingZeros;
      return significantDecimalDigits <= 5;
    }

    return integerDigits + decimalDigits <= 5;
  }

  return true;
}

export function formatSizeInput(input: string, szDecimals: number): string {
  if (!validateSizeInput(input, szDecimals)) return input;
  return input;
}

export function formatPriceInput(input: string, szDecimals?: number): string {
  if (!validatePriceInput(input, szDecimals)) return input;
  return input;
}

export function formatPriceToSignificantDigits(
  price: number,
  maxDigits = 5,
): string {
  if (!price || Number.isNaN(price)) return '0';

  // Convert to significant digits using toPrecision
  const precision = price.toPrecision(maxDigits);

  // Convert back to number to handle scientific notation
  const num = Number(precision);

  // Convert to string and remove trailing zeros
  let result = num.toString();

  // Remove trailing zeros after decimal point
  if (result.includes('.')) {
    result = result.replace(/\.?0+$/, '');
  }

  return result;
}

export function formatPercentage(percent: number): string {
  if (!percent || Number.isNaN(percent)) return '0';

  // Round to 2 decimal places
  const rounded = Math.round(percent * 100) / 100;

  // If it's a whole number, don't show decimal places
  if (Number.isInteger(rounded)) {
    return rounded.toString();
  }

  // Otherwise, show up to 2 decimal places and remove trailing zeros
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}
