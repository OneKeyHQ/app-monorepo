// Keep this function self-contained: native charts embed it in the WebView.
export function formatChartPrice(price: number, maxCharacters = 8): string {
  if (!Number.isFinite(price)) return '--';
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
  const unit = scale?.suffix ?? '';
  const parts = value.toExponential().split('e');
  const digits = parts[0].replace('.', '');
  const exponent = Number(parts[1]) - (scale?.exponent ?? 0);
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
  if (
    value > 0 &&
    !unit &&
    body.length > limit &&
    (zeroCount > 5 || plainWouldLoseAllDigits)
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
