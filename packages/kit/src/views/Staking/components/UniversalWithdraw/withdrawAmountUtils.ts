import BigNumber from 'bignumber.js';

import type {
  IEarnAmountUnit,
  IEarnWithdrawType,
} from '@onekeyhq/shared/types/staking';

/** 按输入单位计算授权数量；明确为份额时不再换算，缺失或无效汇率保留原数量。 */
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
  // 全额赎回可能包含被展示精度舍去的最小份额，授权需向上取整。
  return amountBN
    .multipliedBy(rateBN)
    .integerValue(withdrawAll ? BigNumber.ROUND_CEIL : BigNumber.ROUND_FLOOR)
    .shiftedBy(-decimals)
    .toFixed();
}

/**
 * 份额路径只估算当前能执行的步骤；资产、路径或授权未确认时等待。
 * 未声明份额单位的旧协议保持原来的赎回估费行为。
 */
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
