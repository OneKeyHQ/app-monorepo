import BigNumber from 'bignumber.js';

import type {
  IEarnAmountUnit,
  IEarnWithdrawType,
} from '@onekeyhq/shared/types/staking';

export function getWithdrawApproveAmount({
  amount,
  amountUnit,
  withdrawType,
  receiptTokenRate,
  decimals,
  withdrawAll,
}: {
  amount: string;
  amountUnit?: IEarnAmountUnit;
  withdrawType?: IEarnWithdrawType;
  receiptTokenRate?: string;
  decimals: number;
  withdrawAll: boolean;
}) {
  if (
    amountUnit === 'shares' ||
    withdrawType !== 'queued' ||
    !receiptTokenRate
  ) {
    return amount;
  }
  const amountBN = new BigNumber(amount);
  const rateBN = new BigNumber(receiptTokenRate);
  if (
    !amountBN.isFinite() ||
    amountBN.lte(0) ||
    !rateBN.isFinite() ||
    rateBN.lte(0)
  ) {
    return amount;
  }
  return amountBN
    .multipliedBy(rateBN)
    .integerValue(withdrawAll ? BigNumber.ROUND_CEIL : BigNumber.ROUND_FLOOR)
    .shiftedBy(-decimals)
    .toFixed();
}

export function getWithdrawEstimateStep({
  amountUnit,
  assetsReady,
  pathReady,
  withdrawType,
  allowanceAvailable,
  loadingAllowance,
  allowance,
  amount,
}: {
  amountUnit?: IEarnAmountUnit;
  assetsReady: boolean;
  pathReady: boolean;
  withdrawType?: IEarnWithdrawType;
  allowanceAvailable: boolean;
  loadingAllowance: boolean;
  allowance: string;
  amount: string;
}): { action: 'unstake' | 'approve' } | undefined {
  if (withdrawType === 'cancel' || amountUnit !== 'shares')
    return { action: 'unstake' };
  if (!assetsReady || !pathReady) return undefined;
  if (withdrawType !== 'queued') return { action: 'unstake' };
  const allowanceBN = new BigNumber(allowance);
  const amountBN = new BigNumber(amount);
  if (
    !allowanceAvailable ||
    loadingAllowance ||
    !allowanceBN.isFinite() ||
    !amountBN.isFinite() ||
    amountBN.lte(0)
  ) {
    return undefined;
  }
  return allowanceBN.lt(amountBN)
    ? { action: 'approve' }
    : { action: 'unstake' };
}
