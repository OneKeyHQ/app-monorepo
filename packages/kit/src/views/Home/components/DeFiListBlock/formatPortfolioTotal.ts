import BigNumber from 'bignumber.js';

export function roundPortfolioTotal(total: BigNumber.Value): BigNumber {
  return new BigNumber(total).decimalPlaces(2, BigNumber.ROUND_HALF_UP);
}

/**
 * Currency-prefixed amount for DeFi portfolio displays.
 * Always keeps two decimal places (`$5.23`, `$469,621.00`) to match the other
 * wallet asset value displays. Renders `$****` when the user's hide-balance
 * toggle is on.
 */
export function formatPortfolioTotal(
  total: number,
  currency: string,
  hide: boolean,
): string {
  if (hide) return `${currency}****`;
  if (!Number.isFinite(total)) return `${currency}0.00`;
  const bn = roundPortfolioTotal(total);
  const absTotal = bn.abs();
  const sign = bn.lt(0) ? '-' : '';
  return `${sign}${currency}${absTotal.toFormat(2)}`;
}
