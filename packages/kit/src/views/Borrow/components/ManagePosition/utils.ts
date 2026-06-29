import BigNumber from 'bignumber.js';

import type { IManagePositionProps } from './types';

export function isSamePositiveAmount({
  amount,
  targetAmount,
}: {
  amount: string;
  targetAmount?: string;
}) {
  const amountBN = new BigNumber(amount);
  const targetAmountBN = new BigNumber(targetAmount ?? '0');
  if (amountBN.isNaN() || targetAmountBN.isNaN()) return false;
  return amountBN.gt(0) && amountBN.eq(targetAmountBN);
}

export function resolveRepayAllAmountValue({
  action,
  maxAmountValue,
  repayAllBalance,
}: {
  action: IManagePositionProps['action'];
  maxAmountValue: string;
  repayAllBalance?: string;
}) {
  return action === 'repay'
    ? (repayAllBalance ?? maxAmountValue)
    : maxAmountValue;
}
