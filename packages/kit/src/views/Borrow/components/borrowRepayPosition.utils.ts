import BigNumber from 'bignumber.js';

import { EStakeProgressStep } from '@onekeyhq/kit/src/views/Staking/components/StakeProgress';

export function hasPositiveDebtBalance(debtBalance?: string) {
  const debtBalanceBN = new BigNumber(debtBalance || '0');
  return !debtBalanceBN.isNaN() && debtBalanceBN.gt(0);
}

export function buildBorrowRepayPositionKey({
  amount,
  collateralReserveAddress,
  repayAll,
  slippageBps,
  hasDebtPosition = true,
}: {
  amount: string;
  collateralReserveAddress?: string;
  repayAll: boolean;
  slippageBps?: number;
  hasDebtPosition?: boolean;
}) {
  const amountBN = new BigNumber(amount);
  if (
    !hasDebtPosition ||
    !collateralReserveAddress ||
    amountBN.isNaN() ||
    amountBN.lte(0)
  ) {
    return '';
  }

  return [
    amount,
    collateralReserveAddress,
    repayAll ? '1' : '0',
    String(slippageBps ?? ''),
  ].join(':');
}

export function appendBorrowRepaySetupState({
  requestKey,
  needsSetupLut,
}: {
  requestKey: string;
  needsSetupLut?: boolean;
}) {
  if (!requestKey) {
    return '';
  }

  return `${requestKey}:${needsSetupLut ? 'setup' : 'ready'}`;
}

export function getBorrowRepayProgressStep({
  progressKey,
  needsSetupLut,
  setupReadyProgressKey,
}: {
  progressKey: string;
  needsSetupLut?: boolean;
  setupReadyProgressKey?: string;
}) {
  if (!progressKey) {
    return undefined;
  }

  if (setupReadyProgressKey === progressKey) {
    return EStakeProgressStep.deposit;
  }

  if (needsSetupLut) {
    return EStakeProgressStep.approve;
  }

  return undefined;
}

export function isCollateralRepayEnabled({
  collateralAssetCount,
  collateralLoading,
  debtBalance,
}: {
  collateralAssetCount: number;
  collateralLoading?: boolean;
  debtBalance?: string;
}) {
  return (
    hasPositiveDebtBalance(debtBalance) &&
    (!!collateralLoading || collateralAssetCount > 0)
  );
}
