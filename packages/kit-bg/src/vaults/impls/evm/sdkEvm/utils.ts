import B from 'bignumber.js';

import type { IServerFiatTokenInfo } from '@onekeyhq/shared/types/serverToken';
import type { IToken } from '@onekeyhq/shared/types/token';

// export interface IJsonRpcResponse<T = unknown> {
//   id?: string | number;
//   jsonrpc?: '2.0';
//   result: T;
//   error?: { code?: number; message?: string };
// }

export function safeNumberString(n: string | B | number, fallback?: string) {
  const res = new B(n);

  if (res.isNaN() || !res.isFinite()) {
    return fallback ?? '';
  }

  return res.toString();
}

export const nativeTokenUniqueKey = 'native';
export function parseTokenItem(token: IServerFiatTokenInfo | IToken) {
  const res = {
    balance: token.balance,
    balanceParsed: safeNumberString(token?.balanceParsed ?? ''),
    fiatValue: token.fiatValue,
    price: token.price,
    price24h: token.price24h,
    info: {
      uniqueKey: (token.uniqueKey ?? token.address) || nativeTokenUniqueKey,
      address: token.address,
      decimals: token.decimals,
      isNative: token.isNative,
      logoURI: token.logoURI,
      name: token.name,
      symbol: token.symbol,
      totalSupply: token.totalSupply,
      riskLevel: token.riskLevel,
      adaName: token.adaName,
      sendAddress: token.sendAddress,
      networkId: token.networkId,
    },
  };

  return res;
}
