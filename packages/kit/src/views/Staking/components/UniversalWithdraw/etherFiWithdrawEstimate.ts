import BigNumber from 'bignumber.js';

import type { IEarnWithdrawType } from '@onekeyhq/shared/types/staking';

export function getEtherFiWithdrawEstimateAction({
  isActionDisabled,
  isCancel,
  hasIdentity,
  pathCurrent,
  pathDisabled,
  withdrawType,
  allowanceAvailable,
  loadingAllowance,
  allowance,
  amount,
}: {
  isActionDisabled: boolean;
  isCancel: boolean;
  hasIdentity: boolean;
  pathCurrent: boolean;
  pathDisabled: boolean;
  withdrawType?: IEarnWithdrawType;
  allowanceAvailable: boolean;
  loadingAllowance: boolean;
  allowance: string;
  amount: string;
}): 'approve' | 'unstake' | undefined {
  if (isActionDisabled) return undefined;
  if (isCancel) return hasIdentity ? 'unstake' : undefined;
  if (
    !pathCurrent ||
    pathDisabled ||
    withdrawType !== 'queued' ||
    !allowanceAvailable ||
    loadingAllowance
  )
    return undefined;
  const allowanceBN = new BigNumber(allowance);
  const amountBN = new BigNumber(amount);
  if (
    !allowanceBN.isFinite() ||
    allowanceBN.isNegative() ||
    !amountBN.isFinite() ||
    amountBN.lte(0)
  )
    return undefined;
  return allowanceBN.lt(amountBN) ? 'approve' : 'unstake';
}
