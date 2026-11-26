import BigNumber from 'bignumber.js';

/**
 * The upper end of the "between min and max" hint of an LNURL amount: the
 * service's max, lowered to the wallet's own limit. A limit of 0 means none,
 * as on self-custody Lightning. A range whose max is below its min shows the
 * wallet limit.
 */
export function getLnurlAmountHintMax({
  minAmount,
  maxAmount,
  walletLimit,
}: {
  minAmount: BigNumber;
  maxAmount: BigNumber;
  walletLimit: BigNumber;
}): string {
  if (maxAmount.lt(minAmount)) {
    return walletLimit.toFixed();
  }
  if (walletLimit.gt(0)) {
    return BigNumber.minimum(maxAmount, walletLimit).toFixed();
  }
  return maxAmount.toFixed();
}
