import BigNumber from 'bignumber.js';

import type { IBorrowBalance } from '@onekeyhq/shared/types/staking';

export function hasPositiveDebtBalance(debtBalance?: string) {
  const debtBalanceBN = new BigNumber(debtBalance || '0');
  return !debtBalanceBN.isNaN() && debtBalanceBN.gt(0);
}

export function getBorrowBalanceAmount(balance?: Partial<IBorrowBalance>) {
  return balance?.number ?? balance?.amount ?? balance?.title?.text ?? '0';
}

export function hasPositiveBorrowBalance(balance?: Partial<IBorrowBalance>) {
  const balanceBN = new BigNumber(getBorrowBalanceAmount(balance));
  return !balanceBN.isNaN() && balanceBN.gt(0);
}
