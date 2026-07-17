import BigNumber from 'bignumber.js';

import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { IBorrowMarketItem } from '@onekeyhq/shared/types/staking';

function toNonNegativeAmountBN(value?: string) {
  const amountBN = new BigNumber(value ?? '');
  if (!amountBN.isFinite() || amountBN.lt(0)) return undefined;
  return amountBN;
}

function isSamePositiveAmount({
  amount,
  targetAmount,
}: {
  amount: string;
  targetAmount?: string;
}) {
  const amountBN = new BigNumber(amount);
  const targetAmountBN = new BigNumber(targetAmount ?? '0');
  if (!amountBN.isFinite() || !targetAmountBN.isFinite()) return false;
  return amountBN.gt(0) && amountBN.eq(targetAmountBN);
}

function resolveRepayValueForMax({
  referenceBalance,
  maxRepayBalance,
  repayWalletBalance,
  repayAllTargetAmount,
}: {
  referenceBalance: string;
  maxRepayBalance?: string;
  repayWalletBalance?: string;
  repayAllTargetAmount?: string;
}) {
  const debtLimitAmount = repayAllTargetAmount ?? referenceBalance;
  const debtLimitBN = toNonNegativeAmountBN(debtLimitAmount);
  const maxRepayBN = toNonNegativeAmountBN(maxRepayBalance);
  if (maxRepayBN) {
    if (debtLimitBN?.gt(0) && maxRepayBN.gt(debtLimitBN)) {
      return debtLimitAmount;
    }
    return maxRepayBalance ?? '0';
  }

  const walletBN = toNonNegativeAmountBN(repayWalletBalance);
  if (walletBN) {
    if (debtLimitBN?.gt(0) && walletBN.gt(debtLimitBN)) {
      return debtLimitAmount;
    }
    return repayWalletBalance ?? '0';
  }

  return referenceBalance;
}

export function resolveProtocolLendingWithdrawAmountState({
  amount,
  referenceBalance,
}: {
  amount: string;
  referenceBalance: string;
}) {
  const amountBN = toNonNegativeAmountBN(amount);
  const referenceBalanceBN = toNonNegativeAmountBN(referenceBalance);
  const isAmountInsufficient = Boolean(
    amountBN?.gt(0) &&
    referenceBalanceBN !== undefined &&
    amountBN.gt(referenceBalanceBN),
  );

  return {
    isAmountInsufficient,
  };
}

export function resolveProtocolLendingDefiFillableAmountState({
  isRepay,
  availableAmount,
  repayWalletBalance,
}: {
  isRepay: boolean;
  availableAmount: string;
  repayWalletBalance?: string;
}) {
  const availableBN = new BigNumber(availableAmount || '0');
  const repayWalletBalanceBN =
    isRepay && repayWalletBalance !== undefined
      ? toNonNegativeAmountBN(repayWalletBalance)
      : undefined;
  const isRepayWalletBalanceReady = !isRepay || Boolean(repayWalletBalanceBN);
  const fillableMaxBN =
    isRepay && repayWalletBalanceBN
      ? BigNumber.min(availableBN, repayWalletBalanceBN)
      : new BigNumber(isRepay ? '0' : availableAmount || '0');
  const fillableMax = fillableMaxBN.isFinite()
    ? fillableMaxBN.toFixed()
    : availableAmount;
  const isFillableMaxFullClose =
    !isRepay ||
    (isRepayWalletBalanceReady &&
      availableBN.isFinite() &&
      fillableMaxBN.gte(availableBN));

  return {
    fillableMaxBN,
    fillableMax,
    isRepayWalletBalanceReady,
    isFillableMaxFullClose,
  };
}

export function resolveProtocolLendingRepayAmountState({
  amount,
  referenceBalance,
  maxRepayBalance,
  repayWalletBalance,
  repayAllTargetAmount,
}: {
  amount: string;
  referenceBalance: string;
  maxRepayBalance?: string;
  repayWalletBalance?: string;
  repayAllTargetAmount?: string;
}) {
  const valueForMax = resolveRepayValueForMax({
    referenceBalance,
    maxRepayBalance,
    repayWalletBalance,
    repayAllTargetAmount,
  });
  const amountBN = toNonNegativeAmountBN(amount);
  const debtLimitBN = toNonNegativeAmountBN(
    repayAllTargetAmount ?? referenceBalance,
  );
  const maxRepayBN = toNonNegativeAmountBN(maxRepayBalance);
  const walletBN = toNonNegativeAmountBN(repayWalletBalance);
  const exceedsDebtLimit = Boolean(
    debtLimitBN?.gt(0) && amountBN?.gt(debtLimitBN),
  );
  const exceedsMaxRepay = Boolean(maxRepayBN && amountBN?.gt(maxRepayBN));
  const exceedsWallet = Boolean(walletBN && amountBN?.gt(walletBN));
  const isAmountInsufficient = Boolean(
    amountBN?.gt(0) && (exceedsDebtLimit || exceedsMaxRepay || exceedsWallet),
  );

  return {
    valueForMax,
    isAmountInsufficient,
    // Full close only when a REAL debt target is known and the amount hits it.
    // Without repayAllTargetAmount we can't prove a full repay (referenceBalance
    // may be a wallet-capped max), so degrade to partial — never let a
    // wallet-capped max be reported as repayAll into the borrow build path.
    isFullClose: repayAllTargetAmount
      ? isSamePositiveAmount({ amount, targetAmount: repayAllTargetAmount })
      : false,
  };
}

export function resolveProtocolLendingRepayDebtState({
  selectedBorrowAssetDebt,
  sourceDebtAmount,
  protocolDebtBalance,
  maxRepayBalance,
}: {
  selectedBorrowAssetDebt?: string;
  sourceDebtAmount?: string;
  protocolDebtBalance?: string;
  maxRepayBalance?: string;
}) {
  const repayAllTargetAmount =
    selectedBorrowAssetDebt ?? protocolDebtBalance ?? sourceDebtAmount;

  return {
    referenceBalance: repayAllTargetAmount ?? maxRepayBalance ?? '0',
    repayAllTargetAmount,
  };
}

export function resolveProtocolLendingRemainingDebtState({
  amount,
  debtAmount,
}: {
  amount: string;
  debtAmount?: string;
}) {
  const amountBN = toNonNegativeAmountBN(amount);
  const debtBN = toNonNegativeAmountBN(debtAmount);
  if (!amountBN?.gt(0) || !debtBN?.gt(0)) {
    return undefined;
  }

  const remainingDebtBN = BigNumber.max(debtBN.minus(amountBN), 0);
  return {
    currentDebt: debtBN.toFixed(),
    remainingDebt: remainingDebtBN.toFixed(),
  };
}

export type IProtocolLendingPrimaryBalanceLabel =
  | 'available'
  | 'availableToWithdraw'
  | 'remainingDebt';

export function resolveProtocolLendingBalanceContext({
  isRepay,
  hasKnownDebt,
  walletBalance,
}: {
  isRepay: boolean;
  hasKnownDebt: boolean;
  walletBalance?: string;
}): {
  primaryLabel: IProtocolLendingPrimaryBalanceLabel;
  secondaryWalletBalance: string | undefined;
} {
  let primaryLabel: IProtocolLendingPrimaryBalanceLabel = 'availableToWithdraw';
  if (isRepay) {
    primaryLabel = hasKnownDebt ? 'remainingDebt' : 'available';
  }

  return {
    primaryLabel,
    secondaryWalletBalance: isRepay ? walletBalance : undefined,
  };
}

// The server's /earn/v1/borrow/markets list is the per-environment source of
// truth for which (provider, network, market) combos the borrow stack
// supports. Fail-closed by design: no markets (still loading, fetch failed,
// or env without the market) → undefined → callers keep the generic path.
export function findSupportedBorrowMarket({
  markets,
  provider,
  networkId,
  marketAddress,
}: {
  markets:
    | Array<Pick<IBorrowMarketItem, 'provider' | 'networkId' | 'marketAddress'>>
    | undefined;
  provider: string | undefined;
  networkId: string;
  marketAddress: string | undefined;
}) {
  if (!markets?.length || !provider || !marketAddress) {
    return undefined;
  }
  const normalizedProvider = provider.trim().toLowerCase();
  const normalizedAddress = earnUtils.normalizeBorrowAddress({
    networkId,
    address: marketAddress,
  });
  return markets.find(
    (market) =>
      market.networkId === networkId &&
      market.provider.trim().toLowerCase() === normalizedProvider &&
      earnUtils.normalizeBorrowAddress({
        networkId: market.networkId,
        address: market.marketAddress,
      }) === normalizedAddress,
  );
}
