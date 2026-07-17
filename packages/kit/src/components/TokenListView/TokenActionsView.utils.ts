import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { getSwapBridgeDefaultToToken } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

type ITokenActionSwapSupport = {
  isSupportCrossChain?: boolean;
  isSupportSwap?: boolean;
};

export function buildTokenActionSwapFromToken({
  token,
  networkId,
  networkLogoURI,
}: {
  token: IAccountToken;
  networkId: string;
  networkLogoURI?: string;
}): ISwapToken {
  return {
    contractAddress: token.isNative ? '' : token.address,
    symbol: token.symbol,
    networkId,
    isNative: token.isNative,
    decimals: token.decimals,
    name: token.name,
    logoURI: token.logoURI,
    networkLogoURI,
  };
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

  return undefined;
}
