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

export type IBorrowApprovalActionStep =
  | 'idle'
  | 'submit'
  | 'resetUSDT'
  | 'approve';

export function isBorrowAllowanceEnough({
  amount,
  allowance,
}: {
  amount: string;
  allowance: string;
}) {
  const amountBN = new BigNumber(amount || '0');
  const allowanceBN = new BigNumber(allowance || '0');

  if (amountBN.isNaN() || allowanceBN.isNaN() || amountBN.lte(0)) {
    return false;
  }

  return allowanceBN.gte(amountBN);
}

export function isBorrowAllowanceZero(allowance: string) {
  const allowanceBN = new BigNumber(allowance || '0');
  return !allowanceBN.isNaN() && allowanceBN.eq(0);
}

export function resolveBorrowApprovalActionStep({
  enabled,
  amount,
  allowance,
  shouldResetUSDT,
}: {
  enabled: boolean;
  amount: string;
  allowance: string;
  shouldResetUSDT: boolean;
}): IBorrowApprovalActionStep {
  if (!enabled) {
    return 'idle';
  }

  const amountBN = new BigNumber(amount || '0');
  const allowanceBN = new BigNumber(allowance || '0');

  if (amountBN.isNaN() || allowanceBN.isNaN() || amountBN.lte(0)) {
    return 'idle';
  }

  if (allowanceBN.gte(amountBN)) {
    return 'submit';
  }

  if (shouldResetUSDT && allowanceBN.gt(0)) {
    return 'resetUSDT';
  }

  return 'approve';
}
