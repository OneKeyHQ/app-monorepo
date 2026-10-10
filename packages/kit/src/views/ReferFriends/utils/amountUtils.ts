import BigNumber from 'bignumber.js';

// Parses an API amount string; missing or malformed values count as zero.
export function toAmount(value: string | undefined) {
  const amount = new BigNumber(value ?? 0);
  return amount.isFinite() ? amount : new BigNumber(0);
}
