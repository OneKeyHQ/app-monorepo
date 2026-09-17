import BigNumber from 'bignumber.js';

const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';
const UNITS = [
  { divisor: 1e9, suffix: 'B' },
  { divisor: 1e6, suffix: 'M' },
  { divisor: 1e3, suffix: 'K' },
];

export function formatFinancialValue(
  value: number | null,
  { percent = false, maxCharacters = 8 } = {},
) {
  if (value === null || !Number.isFinite(value)) return '--';
  const amount = new BigNumber(value);
  const absolute = amount.abs();
  let suffix = percent ? '%' : '';
  let text: string;

  if (percent) {
    text = amount.decimalPlaces(1, BigNumber.ROUND_HALF_UP).toFixed();
  } else if (!absolute.isZero() && absolute.lt(0.000_001)) {
    const decimals = absolute.toFixed().split('.')[1];
    const zeros = decimals.match(/^0*/)?.[0].length ?? 0;
    const subscript = String(zeros)
      .split('')
      .map((digit) => SUBSCRIPT_DIGITS[Number(digit)])
      .join('');
    text = `${amount.isNegative() ? '-' : ''}0.0${subscript}${decimals.slice(zeros, zeros + 3)}`;
  } else {
    let unitIndex = UNITS.findIndex((unit) => absolute.gte(unit.divisor));
    let scaled = unitIndex >= 0 ? amount.div(UNITS[unitIndex].divisor) : amount;
    let rounded =
      !absolute.isZero() && absolute.lt(0.01)
        ? scaled.precision(3, BigNumber.ROUND_HALF_UP)
        : scaled.decimalPlaces(2, BigNumber.ROUND_HALF_UP);
    // Promote rounded boundary values (999.999K -> 1M).
    if (rounded.abs().gte(1000) && unitIndex !== 0) {
      unitIndex = unitIndex < 0 ? UNITS.length - 1 : unitIndex - 1;
      scaled = amount.div(UNITS[unitIndex].divisor);
      rounded = scaled.decimalPlaces(2, BigNumber.ROUND_HALF_UP);
    }
    suffix = unitIndex >= 0 ? UNITS[unitIndex].suffix : '';
    text = rounded.toFixed();
  }

  const limit = Math.max(6, maxCharacters);
  if (text.length + suffix.length > limit && /^-?\d+\.\d+$/.test(text)) {
    const numeric = new BigNumber(text);
    for (
      let decimals = text.length - text.indexOf('.') - 2;
      decimals >= 0;
      decimals -= 1
    ) {
      const rounded = numeric.decimalPlaces(decimals, BigNumber.ROUND_HALF_UP);
      const candidate = rounded.toFixed();
      if (!rounded.isZero() && candidate.length + suffix.length <= limit) {
        return `${candidate}${suffix}`;
      }
    }
  }
  return text.length + suffix.length > limit
    ? `${text.slice(0, limit - suffix.length - 3)}...${suffix}`
    : `${text}${suffix}`;
}
