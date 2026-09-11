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
  let body: string;
  if (value > 0 && !unit && exponent < -6) {
    const zeros = String(-exponent - 1).replace(/[0-9]/g, (digit) =>
      '₀₁₂₃₄₅₆₇₈₉'.charAt(Number(digit)),
    );
    body = `0.0${zeros}${digits}`;
  } else if (exponent < 0) {
    body = `0.${'0'.repeat(-exponent - 1)}${digits}`;
  } else {
    const decimalPosition = exponent + 1;
    body =
      decimalPosition >= digits.length
        ? digits + '0'.repeat(decimalPosition - digits.length)
        : `${digits.slice(0, decimalPosition)}.${digits.slice(decimalPosition)}`;
  }
  if (body.length <= limit) return `${prefix}${body}${unit}`;
  // Replace the last two amount positions with an ellipsis; keep currency and unit.
  let end = limit - 2;
  // A zero-count subscript is indivisible, including counts with multiple digits.
  while (/[₀₁₂₃₄₅₆₇₈₉]/.test(body.charAt(end))) end += 1;
  return `${prefix}${body.slice(0, end)}...${unit}`;
}
