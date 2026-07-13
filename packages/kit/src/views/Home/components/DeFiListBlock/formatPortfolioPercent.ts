/**
 * `percent` is the rounded-to-1-decimal display value. When it rounds down to
 * `0.0` but the underlying position is still non-zero, show `<0.1%` so tiny
 * slices don't read as missing data.
 */
export function formatPortfolioPercent(
  percent: number,
  netWorth?: number | string,
): string {
  if (!Number.isFinite(percent)) return '0.0%';
  if (
    percent === 0 &&
    netWorth !== undefined &&
    Math.abs(Number(netWorth)) > 0
  ) {
    return '<0.1%';
  }
  return `${percent.toFixed(1)}%`;
}
