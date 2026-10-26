import type BigNumber from 'bignumber.js';

export function isBelowMinimumOrderValue(orderValue?: BigNumber): boolean {
  return Boolean(
    orderValue?.isFinite() && orderValue.gt(0) && orderValue.lt(10),
  );
}
