export function getPriceDecimals(szDecimals: number): number {
  return Math.abs(szDecimals - 5);
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

interface IParsedNumber {
  integerPart: string;
  decimalPart: string;
  trimmedInteger: string;
  integerDigits: number;
  decimalDigits: number;
}

interface IPriceValidationResult {
  isValid: boolean;
  formatted?: string;
  error?: string;
}

function parseNumberString(numStr: string): IParsedNumber {
  const parts = numStr.split('.');
  const integerPart = parts[0] || '';
  const decimalPart = parts.length > 1 ? parts[1] : '';
  const trimmedInteger = integerPart.replace(/^0+/, '') || '0';
  const integerDigits = trimmedInteger === '0' ? 0 : trimmedInteger.length;
  const decimalDigits = decimalPart.length;

  return {
    integerPart,
    decimalPart,
    trimmedInteger,
    integerDigits,
    decimalDigits,
  };
}

function formatPriceWithRules(
  priceStr: string,
  szDecimals?: number,
  maxSignificantDigits = 5,
): string {
  const parsed = parseNumberString(priceStr);

  // Apply szDecimals constraint first if provided
  if (szDecimals !== undefined && parsed.decimalDigits > 0) {
    const maxDecimalPlaces = Math.max(0, 6 - szDecimals);
    if (parsed.decimalDigits > maxDecimalPlaces) {
      const truncatedDecimal = parsed.decimalPart.substring(
        0,
        maxDecimalPlaces,
      );
      let result = `${parsed.integerPart}.${truncatedDecimal}`;
      result = result.replace(/\.?0+$/, '');
      return result;
    }
  }

  // If integer part >= 5 digits, don't allow decimals
  if (parsed.integerDigits >= 5) {
    return parsed.integerPart;
  }

  // Calculate remaining digits for decimal part
  const remainingDigits = maxSignificantDigits - parsed.integerDigits;

  if (remainingDigits <= 0) {
    return parsed.integerPart;
  }

  // For numbers like 0.012345, count significant digits after leading zeros
  if (parsed.trimmedInteger === '0') {
    const leadingZeros = parsed.decimalPart.match(/^0*/)?.[0].length || 0;
    const significantDecimalPart = parsed.decimalPart.substring(leadingZeros);

    // Check total decimal places limit first (max 5 decimal places for 0.0 prefix cases)
    if (parsed.decimalDigits > 5) {
      const truncatedDecimal = parsed.decimalPart.substring(0, 5);
      let result = `0.${truncatedDecimal}`;
      result = result.replace(/\.?0+$/, '');
      return result;
    }

    if (significantDecimalPart.length <= maxSignificantDigits) {
      let result = priceStr;
      if (result.includes('.')) {
        result = result.replace(/\.?0+$/, '');
      }
      return result;
    }

    const truncated = significantDecimalPart.substring(0, maxSignificantDigits);
    let result = `0.${'0'.repeat(leadingZeros)}${truncated}`;
    result = result.replace(/\.?0+$/, '');
    return result;
  }

  // For cases like 123.45 (integer + decimal)
  const allowedDecimalDigits = Math.min(remainingDigits, 6); // Max 6 decimal places
  const truncatedDecimalPart = parsed.decimalPart.substring(
    0,
    allowedDecimalDigits,
  );

  let result = `${parsed.integerPart}.${truncatedDecimalPart}`;
  result = result.replace(/\.?0+$/, '');

  return result;
}

function validateAndFormatPrice(
  input: string | number,
  options?: {
    szDecimals?: number;
    maxSignificantDigits?: number;
    formatOnly?: boolean;
  },
): IPriceValidationResult {
  const {
    szDecimals,
    maxSignificantDigits = 5,
    formatOnly = false,
  } = options || {};

  if (typeof input === 'number') {
    if (!input || Number.isNaN(input)) {
      return { isValid: false, formatted: '0' };
    }

    const formatted = formatPriceWithRules(
      input.toString(),
      szDecimals,
      maxSignificantDigits,
    );
    return { isValid: true, formatted };
  }

  // Handle string input (validation + formatting)
  if (!input) return { isValid: true, formatted: formatOnly ? '0' : undefined };

  const processedInput = input.replace(/。/g, '.');

  if (!/^[0-9]*\.?[0-9]*$/.test(processedInput)) {
    return { isValid: false, error: 'Invalid characters' };
  }

  if (processedInput.split('.').length > 2) {
    return { isValid: false, error: 'Multiple decimal points' };
  }

  const parsed = parseNumberString(processedInput);

  // Allow incomplete input like "123."
  if (processedInput.endsWith('.') && parsed.decimalPart === '') {
    return { isValid: true };
  }

  // Apply szDecimals constraint if provided
  if (szDecimals !== undefined && parsed.decimalDigits > 0) {
    const maxDecimalPlaces = Math.max(0, 6 - szDecimals);
    if (parsed.decimalDigits > maxDecimalPlaces) {
      return {
        isValid: false,
        error: `Max ${maxDecimalPlaces} decimal places`,
      };
    }
  }

  // For pure integers, allow any length
  if (!processedInput.includes('.')) {
    const formatted = formatOnly
      ? formatPriceWithRules(processedInput, szDecimals, maxSignificantDigits)
      : undefined;
    return { isValid: true, formatted };
  }

  // If integer part >= 6 digits, don't allow decimals
  if (
    parsed.integerDigits >= 6 &&
    parsed.trimmedInteger !== '0' &&
    parsed.decimalDigits > 0
  ) {
    return { isValid: false, error: 'Too many digits' };
  }

  // Apply significant digits rule for decimals
  if (parsed.decimalDigits > 0) {
    if (parsed.integerDigits === 0) {
      if (parsed.decimalDigits > 6) {
        return { isValid: false, error: 'Max 6 decimal places for 0.xxx' };
      }
      const leadingZeros = parsed.decimalPart.match(/^0*/)?.[0].length || 0;
      const significantDecimalDigits = parsed.decimalDigits - leadingZeros;
      if (significantDecimalDigits > maxSignificantDigits) {
        return {
          isValid: false,
          error: `Max ${maxSignificantDigits} significant digits`,
        };
      }
    } else if (
      parsed.integerDigits + parsed.decimalDigits >
      maxSignificantDigits
    ) {
      return {
        isValid: false,
        error: `Max ${maxSignificantDigits} significant digits`,
      };
    }
  }

  const formatted = formatOnly
    ? formatPriceWithRules(processedInput, szDecimals, maxSignificantDigits)
    : undefined;
  return { isValid: true, formatted };
}

export function validatePriceInput(
  input: string,
  szDecimals?: number,
): boolean {
  const result = validateAndFormatPrice(input, { szDecimals });
  return result.isValid;
}

export function formatPriceToSignificantDigits(
  price: number,
  szDecimals?: number,
): string {
  const result = validateAndFormatPrice(price, {
    szDecimals,
    maxSignificantDigits: 5,
    formatOnly: true,
  });
  return result.formatted || '0';
}

export function formatPercentage(percent: number): string {
  if (!percent || Number.isNaN(percent)) return '0';

  const rounded = Math.round(percent * 100) / 100;

  if (Number.isInteger(rounded)) {
    return rounded.toString();
  }

  // Otherwise, show up to 2 decimal places and remove trailing zeros
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}
