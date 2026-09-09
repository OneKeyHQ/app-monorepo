import BigNumber from 'bignumber.js';

import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';

// Scaled-UI (rebase) tokens: approveInfo.amount stays raw (it is the value
// the approve calldata encodes), so the review surface must convert it back
// to the same display basis as the transfer summary. Invalid multipliers
// pass through unchanged, matching applyBalanceMultiplier's policy.
export function getApproveDisplayAmount(approveInfo: IApproveInfo): string {
  return tokenRebaseUtils.applyBalanceMultiplier({
    amount: approveInfo.amount,
    balanceMultiplier: approveInfo.tokenInfo?.balanceMultiplier,
  });
}

export function calculateTotalApproveDisplayAmount(
  approvesInfo: IApproveInfo[],
): string {
  return approvesInfo
    .filter((info) => info.amount !== '0')
    .reduce(
      (sum, info) => sum.plus(getApproveDisplayAmount(info) || '0'),
      new BigNumber(0),
    )
    .toFixed();
}
