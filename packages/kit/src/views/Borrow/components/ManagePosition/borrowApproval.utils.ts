import BigNumber from 'bignumber.js';

import { EApproveType } from '@onekeyhq/shared/types/staking';

import type { IBorrowActionType, IBorrowApproveTarget } from './types';

export function isBorrowTokenApprovalEnabled({
  action,
  approveType,
  approveTarget,
}: {
  action: IBorrowActionType;
  approveType?: EApproveType;
  approveTarget?: IBorrowApproveTarget;
}) {
  return (
    (action === 'supply' || action === 'repay') &&
    approveType === EApproveType.Legacy &&
    !!approveTarget?.spenderAddress &&
    !!approveTarget.token &&
    !approveTarget.token.isNative
  );
}

export function isBorrowTokenApprovalRequired({
  enabled,
  amount,
  allowance,
}: {
  enabled: boolean;
  amount: string;
  allowance: string;
}) {
  if (!enabled) {
    return false;
  }

  const amountBN = new BigNumber(amount || '0');
  const allowanceBN = new BigNumber(allowance || '0');

  if (amountBN.isNaN() || allowanceBN.isNaN() || amountBN.lte(0)) {
    return false;
  }

  return allowanceBN.lt(amountBN);
}
