/**
 * `percent` is the rounded-to-1-decimal display value.
 *
 * Rules:
 * - `≥10%`: show as integer (`32%`) — the 0.X precision is noise at that scale
 * - `<10%`: keep one decimal (`8.2%`) — preserves visibility of small slices
 * - `0` with non-zero netWorth: `<0.1%` so tiny positions don't read as missing
 */
export function formatPortfolioPercent(
  percent: number,
  netWorth?: number | string,
): string {
  if (!Number.isFinite(percent)) return '0.0%';
  if (percent === 0 && netWorth !== undefined && Number(netWorth) > 0) {
    return '<0.1%';
  }
  if (percent >= 10) {
    return `${Math.round(percent)}%`;
  }
  return `${percent.toFixed(1)}%`;
}
