import BigNumber from 'bignumber.js';

import type { IManagePositionProps } from './types';

type IBorrowRepayAllReserveAsset = {
  reserveAddress?: string;
  token?: {
    address?: string;
    symbol?: string;
  };
  borrowedAmount?: {
    amount?: string;
  };
};

function normalizeBorrowAssetAddress(address?: string) {
  return (address ?? '').toLowerCase();
}

const KNOWN_WRAPPED_NATIVE_TOKEN_SYMBOLS: Record<string, string> = {
  ETH: 'WETH',
};

function isKnownWrappedNativeDebtToken({
  debtReserveAddress,
  debtTokenAddress,
  debtTokenSymbol,
  repayTokenSymbol,
}: {
  debtReserveAddress: string;
  debtTokenAddress: string;
  debtTokenSymbol: string;
  repayTokenSymbol: string;
}) {
  if (debtReserveAddress || debtTokenAddress) return false;
  if (!debtTokenSymbol || !repayTokenSymbol) return false;
  return (
    KNOWN_WRAPPED_NATIVE_TOKEN_SYMBOLS[repayTokenSymbol] === debtTokenSymbol
  );
}

export function isSamePositiveAmount({
  amount,
  targetAmount,
}: {
  amount: string;
  targetAmount?: string;
}) {
  const amountBN = new BigNumber(amount);
  const targetAmountBN = new BigNumber(targetAmount ?? '0');
  if (amountBN.isNaN() || targetAmountBN.isNaN()) return false;
  return amountBN.gt(0) && amountBN.eq(targetAmountBN);
}

export function resolveRepayAllAmountValue({
  action,
  maxAmountValue,
  repayAllBalance,
}: {
  action: IManagePositionProps['action'];
  maxAmountValue: string;
  repayAllBalance?: string;
}) {
  return action === 'repay'
    ? (repayAllBalance ?? maxAmountValue)
    : maxAmountValue;
}

export function resolveBorrowRepayAllBalance({
  selectedDebtBalance,
  protocolDebtBalance,
  reserveAddress,
  tokenAddress,
  repayTokenSymbol,
  borrowedAssets,
}: {
  selectedDebtBalance?: string;
  protocolDebtBalance?: string;
  reserveAddress?: string;
  tokenAddress?: string;
  repayTokenSymbol?: string;
  borrowedAssets?: IBorrowRepayAllReserveAsset[];
}) {
  if (selectedDebtBalance) {
    return selectedDebtBalance;
  }
  if (protocolDebtBalance) {
    return protocolDebtBalance;
  }

  const normalizedReserveAddress = normalizeBorrowAssetAddress(reserveAddress);
  const normalizedTokenAddress = normalizeBorrowAssetAddress(tokenAddress);
  const normalizedRepayTokenSymbol = (repayTokenSymbol ?? '').toUpperCase();
  const borrowedAsset = borrowedAssets?.find((item) => {
    const debtReserveAddress = normalizeBorrowAssetAddress(item.reserveAddress);
    const debtTokenAddress = normalizeBorrowAssetAddress(item.token?.address);
    if (
      (normalizedReserveAddress &&
        (debtReserveAddress === normalizedReserveAddress ||
          debtTokenAddress === normalizedReserveAddress)) ||
      (normalizedTokenAddress &&
        (debtReserveAddress === normalizedTokenAddress ||
          debtTokenAddress === normalizedTokenAddress))
    ) {
      return true;
    }

    return isKnownWrappedNativeDebtToken({
      debtReserveAddress,
      debtTokenAddress,
      debtTokenSymbol: item.token?.symbol?.toUpperCase() ?? '',
      repayTokenSymbol: normalizedRepayTokenSymbol,
    });
  });
  return borrowedAsset?.borrowedAmount?.amount;
}
