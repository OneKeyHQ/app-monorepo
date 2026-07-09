import { sortPerpsDepositTokensByFiatValue } from '@onekeyhq/kit-bg/src/services/ServiceWebviewPerp/utils/depositTokenListUtils';
import type { IPerpsDepositToken } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';

export function getPerpsDepositTokenDisplayList(
  tokensByNetwork: Record<string, IPerpsDepositToken[]>,
) {
  return sortPerpsDepositTokensByFiatValue(
    Object.values(tokensByNetwork).flat(),
  );
}

export function shouldUsePerpsDepositLiveWalletTokens({
  atomOwnerKey,
  routeOwnerKey,
  depositTokenListSource,
}: {
  atomOwnerKey?: string;
  routeOwnerKey?: string;
  depositTokenListSource?: 'serverConfig' | 'walletBalance';
}) {
  return (
    Boolean(routeOwnerKey) &&
    atomOwnerKey === routeOwnerKey &&
    depositTokenListSource === 'walletBalance'
  );
}

export function shouldShowPerpsDepositTokenSkeleton({
  selectedAction,
  checkAccountSupport,
  hasLoadedDepositTokenBalances,
  depositTokensWithPriceLength,
  hasDisplayDepositToken,
}: {
  selectedAction: 'deposit' | 'withdraw';
  checkAccountSupport: boolean;
  hasLoadedDepositTokenBalances: boolean;
  depositTokensWithPriceLength: number;
  hasDisplayDepositToken: boolean;
}) {
  return (
    selectedAction === 'deposit' &&
    checkAccountSupport &&
    !hasLoadedDepositTokenBalances &&
    depositTokensWithPriceLength === 0 &&
    !hasDisplayDepositToken
  );
}

export function mergePerpsDepositTokensPreservingOrder({
  currentTokens,
  nextTokens,
}: {
  currentTokens: IPerpsDepositToken[];
  nextTokens: IPerpsDepositToken[];
}) {
  const hasRefreshedFiatValues = nextTokens.some(
    (token) => token.fiatValue !== undefined,
  );
  if (hasRefreshedFiatValues || currentTokens.length === 0) {
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
