import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  getSwapBridgeDefaultToToken,
  swapDefaultSetTokens,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

type ITokenActionSwapSupport = {
  isSupportCrossChain?: boolean;
  isSupportSwap?: boolean;
};

type IOwnedAggregateTokenListMap = Record<
  string,
  {
    tokens: IAccountToken[];
  }
>;

export function buildTokenActionSwapFromToken({
  accountAddress,
  balanceParsed,
  token,
  networkId,
  networkLogoURI,
}: {
  accountAddress?: string;
  balanceParsed?: string;
  token: IAccountToken;
  networkId: string;
  networkLogoURI?: string;
}): ISwapToken {
  return {
    accountAddress,
    balanceParsed,
    contractAddress: token.isNative ? '' : token.address,
    symbol: token.symbol,
    networkId,
    isNative: token.isNative,
    decimals: token.decimals,
    name: token.name,
    logoURI: token.logoURI,
    networkLogoURI,
    balanceMultiplier: token.balanceMultiplier,
  };
}

export function getTokenActionSameNetworkSwapToToken({
  fromToken,
}: {
  fromToken: ISwapToken;
}) {
  const defaultTokens = swapDefaultSetTokens[fromToken.networkId];
  if (!defaultTokens) {
    return undefined;
  }
  if (
    fromToken.isNative &&
    defaultTokens.toToken &&
    !defaultTokens.toToken.isNative &&
    !equalTokenNoCaseSensitive({
      token1: fromToken,
      token2: defaultTokens.toToken,
    })
  ) {
    return defaultTokens.toToken;
  }
  if (
    !fromToken.isNative &&
    defaultTokens.fromToken &&
    defaultTokens.fromToken.isNative &&
    !equalTokenNoCaseSensitive({
      token1: fromToken,
      token2: defaultTokens.fromToken,
    })
  ) {
    return defaultTokens.fromToken;
  }
  return undefined;
}

export function findTokenActionAggregateKey({
  ownedAggregateTokenListMap,
  targetToken,
}: {
  ownedAggregateTokenListMap?: IOwnedAggregateTokenListMap;
  targetToken?: ISwapToken;
}) {
  if (!ownedAggregateTokenListMap || !targetToken) {
    return undefined;
  }
  return Object.entries(ownedAggregateTokenListMap).find(([, entry]) =>
    entry.tokens.some((token) =>
      equalTokenNoCaseSensitive({
        token1: {
          networkId: token.networkId,
          contractAddress: token.isNative ? '' : token.address,
        },
        token2: targetToken,
      }),
    ),
  )?.[0];
}

export function getResolvedTokenActionToken({
  token,
  activeToken,
  aggregateTokens,
}: {
  token: IAccountToken;
  activeToken: IAccountToken;
  aggregateTokens?: IAccountToken[];
}) {
  if (!token.isAggregateToken) {
    return token;
  }

  if (activeToken.isAggregateToken) {
    return undefined;
  }

  return aggregateTokens?.find(
    (aggregateToken) => aggregateToken.$key === activeToken.$key,
  );
}

export function isResolvedTokenActionReady({
  token,
  resolvedToken,
  resolvedAccountId,
  resolvedNetworkId,
}: {
  token: IAccountToken;
  resolvedToken?: IAccountToken;
  resolvedAccountId?: string;
  resolvedNetworkId?: string;
}) {
  if (!resolvedToken) {
    return false;
  }

  if (!token.isAggregateToken) {
    return true;
  }

  if (
    !resolvedToken.networkId ||
    resolvedToken.networkId !== resolvedNetworkId
  ) {
    return false;
  }

  return (
    !resolvedToken.accountId || resolvedToken.accountId === resolvedAccountId
  );
}

export function getTokenActionSwapToToken({
  fromToken,
  swapSupport,
}: {
  fromToken: ISwapToken;
  swapSupport?: ITokenActionSwapSupport;
}) {
  const isBtcNativeToken =
    fromToken.networkId === getNetworkIdsMap().btc &&
    fromToken.isNative &&
    fromToken.symbol.toUpperCase() === 'BTC';

  if (
    isBtcNativeToken ||
    (!swapSupport?.isSupportSwap && swapSupport?.isSupportCrossChain)
  ) {
    return getSwapBridgeDefaultToToken(fromToken);
  }

  if (swapSupport?.isSupportSwap) {
    return getTokenActionSameNetworkSwapToToken({ fromToken });
  }

  return undefined;
}
