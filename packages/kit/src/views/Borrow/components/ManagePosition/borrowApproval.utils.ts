import BigNumber from 'bignumber.js';

import { EApproveType } from '@onekeyhq/shared/types/staking';

import type { IBorrowActionType, IBorrowApproveTarget } from './types';

const borrowMaxApprovalAllowanceThreshold = new BigNumber(2).pow(128);

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
  requiresMaxApproval,
}: {
  enabled: boolean;
  amount: string;
  allowance: string;
  requiresMaxApproval?: boolean;
}) {
  if (!enabled) {
    return false;
  }

  const amountBN = new BigNumber(amount || '0');
  const allowanceBN = new BigNumber(allowance || '0');

  if (amountBN.isNaN() || allowanceBN.isNaN() || amountBN.lte(0)) {
    return false;
  }

  if (requiresMaxApproval) {
    return !isBorrowMaxApprovalAllowanceEnough({ allowance });
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
  requiresMaxApproval,
}: {
  amount: string;
  allowance: string;
  requiresMaxApproval?: boolean;
}) {
  const amountBN = new BigNumber(amount || '0');
  const allowanceBN = new BigNumber(allowance || '0');

  if (amountBN.isNaN() || allowanceBN.isNaN() || amountBN.lte(0)) {
    return false;
  }

  if (requiresMaxApproval) {
    return isBorrowMaxApprovalAllowanceEnough({ allowance });
  }

  return allowanceBN.gte(amountBN);
}

export function isBorrowMaxApprovalAllowanceEnough({
  allowance,
}: {
  allowance: string;
}) {
  const allowanceBN = new BigNumber(allowance || '0');

  if (allowanceBN.isNaN() || allowanceBN.lte(0)) {
    return false;
  }

  return allowanceBN.gte(borrowMaxApprovalAllowanceThreshold);
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
  requiresMaxApproval,
}: {
  enabled: boolean;
  amount: string;
  allowance: string;
  shouldResetUSDT: boolean;
  requiresMaxApproval?: boolean;
}): IBorrowApprovalActionStep {
  if (!enabled) {
    return 'idle';
  }

  const amountBN = new BigNumber(amount || '0');
  const allowanceBN = new BigNumber(allowance || '0');

  if (amountBN.isNaN() || allowanceBN.isNaN() || amountBN.lte(0)) {
    return 'idle';
  }

  if (requiresMaxApproval) {
    if (isBorrowMaxApprovalAllowanceEnough({ allowance })) {
      return 'submit';
    }

    if (shouldResetUSDT && allowanceBN.gt(0)) {
      return 'resetUSDT';
    }

    return 'approve';
  }

  if (allowanceBN.gte(amountBN)) {
    return 'submit';
  }

  if (shouldResetUSDT && allowanceBN.gt(0)) {
    return 'resetUSDT';
  }

  return 'approve';
}
