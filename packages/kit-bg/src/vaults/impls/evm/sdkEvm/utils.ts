import B from 'bignumber.js';

import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';

import type {
  IAccountTokenItemWithInfo,
  ITokenItemWithInfo,
} from './BaseApiProvider';

export interface IJsonRpcResponse<T = unknown> {
  id?: string | number;
  jsonrpc?: '2.0';
  result: T;
  error?: { code?: number; message?: string };
}

export function getRpcResultOrThrow<T>(
  res: IJsonRpcResponse<T> | undefined,
  throwIfError = true,
): T {
  if ((!res || res?.error) && throwIfError) {
    throw new OneKeyInternalError(res?.error?.message || 'rpc call failed');
  }
  return res?.result as T;
}

export function safeNumberString(n: string | B | number, fallback?: string) {
  const res = new B(n);

  if (res.isNaN() || !res.isFinite()) {
    return fallback;
  }

  return res.toString();
}

export const nativeTokenUniqueKey = 'native';
export function parseTokenItem(token: any) {
  const res = {
    balance: token.balance,
    balanceParsed: safeNumberString(token.balanceParsed),
    fiatValue: token.fiatValue,
    price: token.price,
    price24h: token.price24h,
    info: {
      // FIXME: token.address is not unique
      // such as: ada, solana
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
