import BigNumber from 'bignumber.js';

import type { IPerpsDepositToken } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';

type IPerpsDepositWithdrawActionType = 'deposit' | 'withdraw';

export function hasPositivePerpsDepositTokenAmount(tokenAmount?: string) {
  if (!tokenAmount) {
    return false;
  }
  const amountBN = new BigNumber(tokenAmount);
  return !amountBN.isNaN() && amountBN.gt(0);
}

export function shouldWaitForPerpsDepositQuoteDebounce({
  selectedAction,
  isArbitrumUsdcToken,
  canQuoteDepositAmount,
  tokenAmount,
  debouncedTokenAmount,
}: {
  selectedAction: IPerpsDepositWithdrawActionType;
  isArbitrumUsdcToken: boolean;
  canQuoteDepositAmount: boolean;
  tokenAmount: string;
  debouncedTokenAmount: string;
}) {
  return (
    selectedAction === 'deposit' &&
    !isArbitrumUsdcToken &&
    canQuoteDepositAmount &&
    hasPositivePerpsDepositTokenAmount(tokenAmount) &&
    tokenAmount !== debouncedTokenAmount
  );
}

export function shouldRefreshPerpsDepositQuote({
  selectedAction,
  isArbitrumUsdcToken,
  canQuoteDepositAmount,
  isQuoteLoading,
  tokenAmount,
  quoteToAmount,
}: {
  selectedAction: IPerpsDepositWithdrawActionType;
  isArbitrumUsdcToken: boolean;
  canQuoteDepositAmount: boolean;
  isQuoteLoading: boolean;
  tokenAmount: string;
  quoteToAmount?: string;
}) {
  if (
    selectedAction !== 'deposit' ||
    isArbitrumUsdcToken ||
    !canQuoteDepositAmount ||
    isQuoteLoading ||
    !hasPositivePerpsDepositTokenAmount(tokenAmount)
  ) {
    return false;
  }

  const quoteAmountBN = new BigNumber(quoteToAmount || '0');
  return quoteAmountBN.isNaN() || quoteAmountBN.lte(0);
}

export function getPerpsDepositMinAmountTextColor(
  selectedAction: IPerpsDepositWithdrawActionType,
) {
  return selectedAction === 'deposit' ? '$textCritical' : '$textSubdued';
}

export function mergePerpsDepositTokensPreservingOrder({
  currentTokens,
  nextTokens,
}: {
  currentTokens: IPerpsDepositToken[];
  nextTokens: IPerpsDepositToken[];
}) {
  if (currentTokens.length === 0) {
    return nextTokens;
  }

  const usedNextTokenIndexes = new Set<number>();
  const mergedTokens = currentTokens.reduce<IPerpsDepositToken[]>(
    (memo, currentToken) => {
      const nextTokenIndex = nextTokens.findIndex((nextToken, index) => {
        if (usedNextTokenIndexes.has(index)) {
          return false;
        }
        return equalTokenNoCaseSensitive({
          token1: currentToken,
          token2: nextToken,
        });
      });

      if (nextTokenIndex === -1) {
        return memo;
      }

      usedNextTokenIndexes.add(nextTokenIndex);
      memo.push(nextTokens[nextTokenIndex]);
      return memo;
    },
    [],
  );

  const appendedTokens = nextTokens.filter(
    (_, index) => !usedNextTokenIndexes.has(index),
  );
  return [...mergedTokens, ...appendedTokens];
}
