import BigNumber from 'bignumber.js';

import {
  type IDisplayNumber,
  formatBalance,
  formatDisplayNumber,
  formatValue,
} from './numberUtils';

const PRO2_PORTFOLIO_SUBSCRIPT_THRESHOLD = 4;
const PRO2_PORTFOLIO_TOKEN_SIGNIFICANT_DIGITS = 4;
const PRO2_PORTFOLIO_TOTAL_SIGNIFICANT_DIGITS = 4;
const PRO2_PORTFOLIO_FIAT_DECIMAL_PLACES = 2;
const PRO2_PORTFOLIO_TOTAL_MAX_BYTES = 47;
const PRO2_PORTFOLIO_TOTAL_MIN_FONT_MAX_WIDTH = 350;
const PRO2_PORTFOLIO_TOTAL_UNKNOWN_GLYPH_WIDTH = 16;
const PRO2_PORTFOLIO_TOKEN_MAX_Q = new BigNumber('999.9');
const PRO2_PORTFOLIO_FIAT_MAX_Q = new BigNumber('999.99');
const PRO2_PORTFOLIO_SUBSCRIPT_DIGITS = [
  '₀',
  '₁',
  '₂',
  '₃',
  '₄',
  '₅',
  '₆',
  '₇',
  '₈',
  '₉',
] as const;
const PRO2_PORTFOLIO_UNITS = [
  { divisor: new BigNumber(1), unit: '' },
  { divisor: new BigNumber(1e3), unit: 'K' },
  { divisor: new BigNumber(1e6), unit: 'M' },
  { divisor: new BigNumber(1e9), unit: 'B' },
  { divisor: new BigNumber(1e12), unit: 'T' },
  { divisor: new BigNumber(1e15), unit: 'Q' },
] as const;
// Use the widest digit advance so the App never underestimates Firmware text
// width when a generated font enables tabular figures.
const PRO2_PORTFOLIO_TOTAL_GLYPH_WIDTHS: Readonly<Record<string, number>> = {
  ' ': 3.84,
  '\u00a0': 3.84,
  '\u202f': 3.84,
  $: 9.424,
  '+': 9.92,
  ',': 3.28,
  '-': 6.48,
  '.': 3.456,
  '0': 10.112,
  '1': 10.112,
  '2': 10.112,
  '3': 10.112,
  '4': 10.112,
  '5': 10.112,
  '6': 10.112,
  '7': 10.112,
  '8': 10.112,
  '9': 10.112,
  '<': 9.92,
  '>': 9.92,
  A: 10.56,
  B: 10.016,
  C: 11.536,
  D: 10.992,
  E: 9.152,
  F: 8.688,
  G: 11.872,
  H: 11.392,
  I: 4.096,
  J: 5.296,
  K: 10.048,
  L: 8.512,
  M: 13.664,
  N: 11.424,
  O: 12.432,
  P: 9.568,
  Q: 12.432,
  R: 10.096,
  S: 9.664,
  T: 8.912,
  U: 10.992,
  V: 10.352,
  W: 15.856,
  X: 9.12,
  Y: 9.728,
  Z: 9.456,
  e: 8.976,
  '£': 9.392,
  '¥': 10.08,
  '€': 10.768,
  '₦': 13.136,
  '₩': 16,
  '₪': 13.136,
  '₫': 9.328,
  '₴': 12.096,
  '₽': 10.592,
  '₺': 10.24,
  '₿': 9.936,
  '₹': 9.68,
  '₱': 11.456,
  '฿': 9.936,
};

function normalizeNonnegativeAmount(value: BigNumber.Value): BigNumber {
  const amount = new BigNumber(value);
  return amount.isFinite() && !amount.isNegative() ? amount : new BigNumber(0);
}

function getInitialUnitIndex(value: BigNumber): number {
  for (let index = PRO2_PORTFOLIO_UNITS.length - 1; index > 0; index -= 1) {
    if (value.gte(PRO2_PORTFOLIO_UNITS[index].divisor)) {
      return index;
    }
  }
  return 0;
}

function stringifyDisplayNumber(
  value: ReturnType<typeof formatDisplayNumber>,
): string {
  if (typeof value === 'string') {
    return value.replaceAll('＜', '<');
  }
  return value
    .map((part) => {
      if (typeof part === 'string' || part.type === 'decimal') {
        return typeof part === 'string' ? part : part.value;
      }
      return String(part.value)
        .split('')
        .map((digit) => PRO2_PORTFOLIO_SUBSCRIPT_DIGITS[Number(digit)])
        .join('');
    })
    .join('')
    .replaceAll('＜', '<');
}

function toSubscript(value: number): string {
  return String(value)
    .split('')
    .map((digit) => PRO2_PORTFOLIO_SUBSCRIPT_DIGITS[Number(digit)])
    .join('');
}

function stringifyTokenNumber(value: IDisplayNumber): string {
  const { decimalSymbol } = value.meta;
  if (decimalSymbol) {
    const separator = decimalSymbol;
    const separatorIndex = value.formattedValue.lastIndexOf(separator);
    if (separatorIndex >= 0) {
      const integerPart = value.formattedValue.slice(0, separatorIndex);
      const decimalPart = value.formattedValue.slice(
        separatorIndex + separator.length,
      );
      const roundedLeadingZeros = decimalPart.match(/^0*/u)?.[0].length ?? 0;
      if (
        roundedLeadingZeros >= PRO2_PORTFOLIO_SUBSCRIPT_THRESHOLD &&
        roundedLeadingZeros < decimalPart.length
      ) {
        return `${integerPart}${separator}0${toSubscript(
          roundedLeadingZeros,
        )}${decimalPart.slice(roundedLeadingZeros)}`;
      }
    }
  }
  return stringifyDisplayNumber(formatDisplayNumber(value));
}

function formatTokenCoefficient(value: BigNumber): string {
  return stringifyTokenNumber(
    formatBalance(value.toFixed(), { disableThousandSeparator: true }),
  );
}

function formatFiatCoefficient(
  value: BigNumber,
  currencyPrefix: string,
): string {
  return stringifyDisplayNumber(
    formatDisplayNumber(
      formatValue(value.toFixed(PRO2_PORTFOLIO_FIAT_DECIMAL_PLACES), {
        currency: currencyPrefix,
        disableThousandSeparator: true,
      }),
    ),
  );
}

export function formatPro2PortfolioBalance(value: BigNumber.Value): string {
  const amount = normalizeNonnegativeAmount(value);
  if (amount.isZero()) {
    return '0';
  }

  let unitIndex = getInitialUnitIndex(amount);
  let coefficient = amount
    .div(PRO2_PORTFOLIO_UNITS[unitIndex].divisor)
    .precision(
      PRO2_PORTFOLIO_TOKEN_SIGNIFICANT_DIGITS,
      BigNumber.ROUND_HALF_UP,
    );

  while (coefficient.gte(1000) && unitIndex < PRO2_PORTFOLIO_UNITS.length - 1) {
    unitIndex += 1;
    coefficient = amount
      .div(PRO2_PORTFOLIO_UNITS[unitIndex].divisor)
      .precision(
        PRO2_PORTFOLIO_TOKEN_SIGNIFICANT_DIGITS,
        BigNumber.ROUND_HALF_UP,
      );
  }

  if (
    unitIndex === PRO2_PORTFOLIO_UNITS.length - 1 &&
    coefficient.gt(PRO2_PORTFOLIO_TOKEN_MAX_Q)
  ) {
    return `>${formatTokenCoefficient(PRO2_PORTFOLIO_TOKEN_MAX_Q)}Q`;
  }

  return `${formatTokenCoefficient(coefficient)}${
    PRO2_PORTFOLIO_UNITS[unitIndex].unit
  }`;
}

export function formatPro2PortfolioFiat(
  value: BigNumber.Value,
  currencyPrefix: string,
): string {
  const amount = normalizeNonnegativeAmount(value);
  if (amount.gt(0) && amount.lt(0.01)) {
    return stringifyDisplayNumber(
      formatDisplayNumber(
        formatValue(amount.toFixed(), { currency: currencyPrefix }),
      ),
    );
  }

  let unitIndex = getInitialUnitIndex(amount);
  let coefficient = amount
    .div(PRO2_PORTFOLIO_UNITS[unitIndex].divisor)
    .decimalPlaces(PRO2_PORTFOLIO_FIAT_DECIMAL_PLACES, BigNumber.ROUND_HALF_UP);

  while (coefficient.gte(1000) && unitIndex < PRO2_PORTFOLIO_UNITS.length - 1) {
    unitIndex += 1;
    coefficient = amount
      .div(PRO2_PORTFOLIO_UNITS[unitIndex].divisor)
      .decimalPlaces(
        PRO2_PORTFOLIO_FIAT_DECIMAL_PLACES,
        BigNumber.ROUND_HALF_UP,
      );
  }

  if (
    unitIndex === PRO2_PORTFOLIO_UNITS.length - 1 &&
    coefficient.gt(PRO2_PORTFOLIO_FIAT_MAX_Q)
  ) {
    return `> ${formatFiatCoefficient(
      PRO2_PORTFOLIO_FIAT_MAX_Q,
      currencyPrefix,
    )}Q`;
  }

  return `${formatFiatCoefficient(coefficient, currencyPrefix)}${
    PRO2_PORTFOLIO_UNITS[unitIndex].unit
  }`;
}

export function formatPro2PortfolioTotalFiat(
  value: BigNumber.Value,
  currencyPrefix: string,
): string {
  const amount = normalizeNonnegativeAmount(value);
  const full = stringifyDisplayNumber(
    formatDisplayNumber(
      formatValue(amount.toFixed(), {
        currency: currencyPrefix,
      }),
    ),
  );

  if (amount.isZero() || amount.lt(0.01)) {
    return full;
  }

  const fullBytesLength = Buffer.byteLength(full, 'utf8');
  const fullWidth = Array.from(full).reduce(
    (width, character) =>
      width +
      (PRO2_PORTFOLIO_TOTAL_GLYPH_WIDTHS[character] ??
        PRO2_PORTFOLIO_TOTAL_UNKNOWN_GLYPH_WIDTH),
    0,
  );
  if (
    fullBytesLength <= PRO2_PORTFOLIO_TOTAL_MAX_BYTES &&
    fullWidth <= PRO2_PORTFOLIO_TOTAL_MIN_FONT_MAX_WIDTH
  ) {
    return full;
  }

  return `${currencyPrefix}${amount.toExponential(
    PRO2_PORTFOLIO_TOTAL_SIGNIFICANT_DIGITS - 1,
    BigNumber.ROUND_HALF_UP,
  )}`;
}
