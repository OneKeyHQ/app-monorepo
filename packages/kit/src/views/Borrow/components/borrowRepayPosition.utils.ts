import BigNumber from 'bignumber.js';

import { EStakeProgressStep } from '@onekeyhq/kit/src/views/Staking/components/stakeProgressStep';
import {
  EBorrowProviderEnum,
  type IBorrowAsset,
} from '@onekeyhq/shared/types/staking';

import {
  getBorrowBalanceAmount,
  hasPositiveDebtBalance,
} from './borrowBalance.utils';

export {
  hasPositiveDebtBalance,
  getBorrowBalanceAmount,
  hasPositiveBorrowBalance,
} from './borrowBalance.utils';
export {
  getBorrowAssetByReserveAddress,
  getBorrowReserveTokenByAddress,
  shouldUseAaveNativeGateway,
  isAaveBorrowProvider,
  isUnsupportedAaveNativeReserve,
  filterUnsupportedAaveNativeReserveAssets,
  getValidBorrowSelectedAsset,
  buildBorrowTokenFromAsset,
  buildAaveNativeGatewayReceiveToken,
  resolveBorrowTokenApproveSpenderAddress,
} from './borrowReserve.utils';

const collateralRepayProviderAllowlist = new Set<string>([
  EBorrowProviderEnum.Kamino,
]);

export function getBorrowRepayDebtBalance({
  selectedAsset,
  fallbackDebtBalance,
}: {
  selectedAsset?: IBorrowAsset | null;
  fallbackDebtBalance?: string;
}) {
  if (selectedAsset) {
    return getBorrowBalanceAmount(selectedAsset.borrowed);
  }
  return fallbackDebtBalance ?? '0';
}

export function getBorrowRepayWalletBalance({
  selectedAsset,
  fallbackWalletBalance,
}: {
  selectedAsset?: IBorrowAsset | null;
  fallbackWalletBalance?: string;
}) {
  if (selectedAsset) {
    if (!selectedAsset.walletBalance) {
      return {
        balance: '0',
        missingWalletBalance: true,
      };
    }
    return {
      balance: getBorrowBalanceAmount(selectedAsset.walletBalance),
      missingWalletBalance: false,
    };
  }

  return {
    balance: fallbackWalletBalance ?? '0',
    missingWalletBalance: false,
  };
}

export function getBorrowRepayMaxInputBalance({
  walletBalance,
  debtBalance,
}: {
  walletBalance?: string;
  debtBalance?: string;
}) {
  const walletBalanceBN = new BigNumber(walletBalance || '0');
  const debtBalanceBN = new BigNumber(debtBalance || '0');

  if (walletBalanceBN.isNaN() || debtBalanceBN.isNaN()) {
    return '0';
  }

  return BigNumber.min(walletBalanceBN, debtBalanceBN).toFixed();
}

export function isBorrowRepayAllAmount({
  amount,
  debtBalance,
}: {
  amount: string;
  debtBalance?: string;
}) {
  const amountBN = new BigNumber(amount || '0');
  const debtBalanceBN = new BigNumber(debtBalance || '0');

  if (amountBN.isNaN() || debtBalanceBN.isNaN()) {
    return false;
  }

  return amountBN.gt(0) && debtBalanceBN.gt(0) && amountBN.gte(debtBalanceBN);
}

export function buildBorrowRepayWithCollateralConfirmationParams(params: {
  accountId: string;
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  amount: string;
  collateralReserveAddress: string;
  repayAll: boolean;
  slippageBps: number;
}) {
  return {
    ...params,
    action: 'repayWithCollateral' as const,
  };
}

export function buildBorrowRepayPositionKey({
  amount,
  collateralReserveAddress,
  repayAll,
  slippageBps,
  hasDebtPosition = true,
  scopeKey,
}: {
  amount: string;
  collateralReserveAddress?: string;
  repayAll: boolean;
  slippageBps?: number;
  hasDebtPosition?: boolean;
  scopeKey?: string;
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
    ...(scopeKey ? [scopeKey] : []),
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

export function getEffectiveBorrowRepayNeedsSetupLut({
  progressKey,
  needsSetupLut,
  setupReadyProgressKey,
}: {
  progressKey: string;
  needsSetupLut?: boolean;
  setupReadyProgressKey?: string;
}) {
  return Boolean(
    needsSetupLut && (!progressKey || setupReadyProgressKey !== progressKey),
  );
}

export function isCollateralRepayEnabled({
  providerName,
  collateralAssetCount,
  collateralLoading,
  debtBalance,
}: {
  providerName?: string;
  collateralAssetCount: number;
  collateralLoading?: boolean;
  debtBalance?: string;
}) {
  if (
    !providerName ||
    !collateralRepayProviderAllowlist.has(providerName.toLowerCase())
  ) {
    return false;
  }

  return (
    hasPositiveDebtBalance(debtBalance) &&
    (!!collateralLoading || collateralAssetCount > 0)
  );
}
