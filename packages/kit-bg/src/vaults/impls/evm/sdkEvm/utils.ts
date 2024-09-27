import B from 'bignumber.js';

import type { IServerFiatTokenInfo } from '@onekeyhq/shared/types/serverToken';
import type { IToken } from '@onekeyhq/shared/types/token';

export function safeNumberString(n: string | B | number, fallback?: string) {
  const res = new B(n);

  if (res.isNaN() || !res.isFinite()) {
    return fallback ?? '';
  }

  return res.toString();
}

export const nativeTokenUniqueKey = 'native';

function isServerFiatTokenInfo(
  token: IServerFiatTokenInfo | IToken,
): token is IServerFiatTokenInfo {
  return 'balance' in token;
}
export function parseTokenItem(token: IServerFiatTokenInfo | IToken) {
  const res = {
    balance: isServerFiatTokenInfo(token) ? token.balance : undefined,
    balanceParsed: isServerFiatTokenInfo(token)
      ? safeNumberString(token.balanceParsed ?? '')
      : undefined,
    fiatValue: isServerFiatTokenInfo(token) ? token.fiatValue : undefined,
    price: isServerFiatTokenInfo(token) ? token.price : undefined,
    price24h: isServerFiatTokenInfo(token) ? token.price24h : undefined,
    info: {
      uniqueKey: (token.uniqueKey ?? token.address) || nativeTokenUniqueKey,
      address: token.address,
      decimals: token.decimals,
      isNative: token.isNative,
      logoURI: token.logoURI,
      name: token.name,
      symbol: token.symbol,
      totalSupply: isServerFiatTokenInfo(token) ? token.totalSupply : undefined,
      riskLevel: token.riskLevel,
      adaName: isServerFiatTokenInfo(token) ? token.adaName : undefined,
      sendAddress: token.sendAddress,
      networkId: token.networkId,
    },
  };

  return res;
}
