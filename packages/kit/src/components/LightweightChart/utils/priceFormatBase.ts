// lightweight-charts never spaces price ticks closer than `1 / base`, and its
// default base is 100 (a 0.01 step). A token trading around $0.0004 then has
// no tick but $0 to print, so the base follows the smallest quote instead:
// four significant digits below $1 (what the axis formatter prints), cents
// once any quote reaches $1. Ticks from $1 up print cents only, so a finer
// step on a range crossing $1 would repeat `$1.00` at different levels.
const MIN_PRICE_FORMAT_BASE = 100;
// Tick spans are compared with a 1e-14 epsilon inside the library, so the
// step has to stay well above it.
const MAX_PRICE_FORMAT_BASE = 1e12;
const SIGNIFICANT_DIGITS_BELOW_ONE = 4;

export function getChartPriceFormatBase(prices: number[]): number {
  let minPositive = Infinity;
  let maxValue = 0;
  for (const price of prices) {
    const value = Math.abs(price);
    if (Number.isFinite(value) && value > 0) {
      minPositive = Math.min(minPositive, value);
      maxValue = Math.max(maxValue, value);
    }
  }
  if (!Number.isFinite(minPositive) || maxValue >= 1) {
    return MIN_PRICE_FORMAT_BASE;
  }
  const exponent = Math.floor(Math.log10(minPositive));
  const base = 10 ** (SIGNIFICANT_DIGITS_BELOW_ONE - 1 - exponent);
  return Math.min(MAX_PRICE_FORMAT_BASE, Math.max(MIN_PRICE_FORMAT_BASE, base));
}
