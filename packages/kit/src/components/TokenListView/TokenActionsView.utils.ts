import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

export function buildTokenActionSwapFromToken({
  token,
  networkId,
  networkLogoURI,
}: {
  token: IAccountToken;
  networkId: string;
  networkLogoURI?: string;
}): ISwapToken {
  // Home owns the token selection intent; Swap resolves address-scoped balance.
  return {
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
