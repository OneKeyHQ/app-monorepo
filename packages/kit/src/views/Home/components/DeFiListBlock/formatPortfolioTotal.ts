import BigNumber from 'bignumber.js';

// Net worth above this reads as "substantial"; cents are noise at that scale.
// Below it, two decimals stay informative.
const PORTFOLIO_DECIMAL_THRESHOLD = 10;

/**
 * Currency-prefixed total for the DeFi portfolio hero display.
 * < $10 keeps two decimals (`$5.23`); ≥ $10 rounds to an integer with
 * thousands separators (`$469,621`) so the cents aren't visual noise at
 * larger scales. Renders `$****` when the user's hide-balance toggle is on.
 */
export function formatPortfolioTotal(
  total: number,
  currency: string,
  hide: boolean,
): string {
  if (hide) return `${currency}****`;
  if (!Number.isFinite(total)) return `${currency}0.00`;
  const bn = new BigNumber(total);
  const absTotal = bn.abs();
  const sign = bn.lt(0) ? '-' : '';
  if (absTotal.lt(PORTFOLIO_DECIMAL_THRESHOLD)) {
    return `${sign}${currency}${absTotal.toFormat(2)}`;
  }
  return `${sign}${currency}${absTotal.decimalPlaces(0).toFormat()}`;
}
