// Keep this function self-contained: native charts embed it in the WebView.
export function formatChartPrice(
  price: number,
  maxCharacters = 8,
  stockPrice = false,
  // From $1 up to $1M, print the figure in full instead of K/M/B: 'cents' as
  // `$2,377.04`, 'whole' as `$2,377` (for ticks already on whole dollars).
  fullPrice: false | 'cents' | 'whole' = false,
): string {
  if (!Number.isFinite(price)) return '--';
  if (fullPrice && Math.abs(price) >= 1) {
    const match = /^(-?\$)(\d+)\.(\d{2})$/.exec(
      formatChartPrice(price, maxCharacters, true),
    );
    if (match && Number(match[2]) < 1e6) {
      const integer = match[2].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return fullPrice === 'whole'
        ? `${match[1]}${integer}`
        : `${match[1]}${integer}.${match[3]}`;
    }
    return formatChartPrice(price, maxCharacters);
  }
  if (stockPrice && Math.abs(price) >= 1) {
    // Round the decimal digits half-up, avoiding binary midpoint errors.
    const [mantissa, exponentText] = Math.abs(price).toExponential().split('e');
    const decimalPosition = Number(exponentText) + 1;
    const digits = mantissa.replace('.', '').padEnd(decimalPosition + 3, '0');
    const cents = digits.slice(0, decimalPosition + 2).split('');
    if (digits.charAt(decimalPosition + 2) >= '5') {
      let index = cents.length - 1;
      while (index >= 0 && cents[index] === '9') {
        cents[index] = '0';
        index -= 1;
      }
      if (index < 0) cents.unshift('1');
      else cents[index] = String(Number(cents[index]) + 1);
    }
    return `${price < 0 ? '-' : ''}$${cents.slice(0, -2).join('')}.${cents.slice(-2).join('')}`;
  }
  const limit = Number.isFinite(maxCharacters)
    ? Math.max(4, Math.floor(maxCharacters))
    : 8;
  // Axis arithmetic can yield 0.7000000000000002. Remove binary noise before
  // counting decimal zeros or applying the display-length limit.
  const value = Number(Math.abs(price).toPrecision(15));
  const prefix = price < 0 ? '-$' : '$';
  const scale = [
    { exponent: 9, suffix: 'B' },
    { exponent: 6, suffix: 'M' },
    { exponent: 3, suffix: 'K' },
  ].find((item) => value >= 10 ** item.exponent);
  let unit = scale?.suffix ?? '';
  const parts = value.toExponential().split('e');
  let digits = parts[0].replace('.', '');
  let exponent = Number(parts[1]) - (scale?.exponent ?? 0);
  // Sub-$1 quotes must read exactly like the page header's `formatPrice`:
  // four significant digits, rounded half-up. `toExponential()` returns the
  // shortest round-trip decimal, so rounding that digit string reproduces
  // BigNumber's ROUND_HALF_UP on the original decimal rather than the double's
  // binary neighbour (0.0012345 -> "0.001235", not toFixed's "0.001234").
  const isSubDollar = value > 0 && !unit && exponent < 0;
  if (isSubDollar) {
    if (digits.length > 4) {
      const kept = digits.slice(0, 4);
      if (digits.charAt(4) >= '5') {
        const bumped = String(Number(kept) + 1);
        if (bumped.length > kept.length) {
          // 9999 -> 10000: one more integer digit, so the decimal point moves.
          digits = bumped.slice(0, 4);
          exponent += 1;
        } else {
          digits = bumped;
        }
      } else {
        digits = kept;
      }
    }
    digits = digits.replace(/0+$/, '') || '0';
  }
  const decimalPosition = exponent + 1;
  let body: string;
  if (decimalPosition <= 0) {
    body = `0.${'0'.repeat(-decimalPosition)}${digits}`;
  } else {
    body =
      decimalPosition >= digits.length
        ? digits + '0'.repeat(decimalPosition - digits.length)
        : `${digits.slice(0, decimalPosition)}.${digits.slice(decimalPosition)}`;
  }
  const zeroCount = -exponent - 1;
  const plainWouldLoseAllDigits = zeroCount >= Math.max(1, limit - 2) - 2;
  // `> 4` mirrors `formatDisplayNumber`, which switches the header to the
  // subscript form at the same point. The length test is only a width fallback
  // for callers with a budget too small for the plain form.
  if (
    value > 0 &&
    !unit &&
    (zeroCount > 4 || (body.length > limit && plainWouldLoseAllDigits))
  ) {
    const zeros = String(zeroCount).replace(/[0-9]/g, (digit) =>
      '₀₁₂₃₄₅₆₇₈₉'.charAt(Number(digit)),
    );
    body = `0.0${zeros}${digits}`;
  }
  // Compact units follow OKX: "$76.82K", not an 8-character dump like "$76.81904K".
  // Dollar amounts >= 1 also stay at 2 decimals so "$716.68..." never appears.
  if (body.includes('.') && (unit || value >= 1)) {
    body = String(Math.round(Number(body) * 100) / 100);
    if (Number(body) >= 1000) {
      let nextUnit = '';
      if (unit === '') nextUnit = 'K';
      else if (unit === 'K') nextUnit = 'M';
      else if (unit === 'M') nextUnit = 'B';
      if (nextUnit) {
        unit = nextUnit;
        body = String(Number(body) / 1000);
      }
    }
  }
  if (body.length <= limit) return `${prefix}${body}${unit}`;
  // Prefer dropping extra decimals over inserting "...". Trailing ellipsis is
  // only for integer/unit bodies that still cannot fit.
  if (body.includes('.')) {
    body = body.slice(0, limit).replace(/\.$/, '');
    if (body.length <= limit) return `${prefix}${body}${unit}`;
  }
  return `${prefix}${body.slice(0, limit)}${unit}...`;
}

// Stock quotes on the mobile detail chart keep two decimals, matching the
// headline (`$341.70`, not `$341.7`). Amounts under $1 stay on the shared
// compact formatter.
export function formatStockChartPrice(price: number): string {
  return formatChartPrice(price, 10, true);
}

// The axis prints the quote in full up to this size, then falls back to the
// compact M / B form.
const FULL_PRICE_COMPACT_FROM = 1e6;
const FULL_PRICE_MAX_CHARACTERS = 10;

// Price labels (last price, previous close): `$2,377.04` instead of `$2.38K`.
// Sub-dollar quotes keep the shared compact form.
export function formatChartPriceFull(price: number): string {
  return formatChartPrice(price, FULL_PRICE_MAX_CHARACTERS, false, 'cents');
}

// Axis ticks. Whole-dollar steps drop the decimals (`$2,540`); any fractional
// step keeps two on every tick so the column stays aligned. The native WebView
// mirrors this decision in `getTickPriceFormatter` (htmlTemplate.ts).
export function formatChartPriceFullTicks(prices: number[]): string[] {
  const values = prices.map((price) =>
    Number.isFinite(price) ? Number(price.toPrecision(15)) : price,
  );
  const wholeDollarTicks =
    values.some((value) => Math.abs(value) >= 1) &&
    values.every(
      (value) =>
        Number.isInteger(value) && Math.abs(value) < FULL_PRICE_COMPACT_FROM,
    );
  return values.map((value) =>
    formatChartPrice(
      value,
      FULL_PRICE_MAX_CHARACTERS,
      false,
      wholeDollarTicks ? 'whole' : 'cents',
    ),
  );
}
