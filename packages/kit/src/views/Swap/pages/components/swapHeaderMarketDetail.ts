import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { resolveMarketStockId } from '../../../Market/MarketDetailV2/utils/resolveIsStockToken';

export type ISwapToTokenMarketDetail = {
  tokenAddress: string;
  address: string;
  networkId: string;
  symbol: string;
  name: string;
  decimals: number;
  isNative?: boolean;
  tokenImageUri?: string;
};

export type ISwapStockMarketDetailTarget = {
  stockId: string;
  symbol: string;
  name: string;
  logoUrl: string;
  tokenAddress?: string;
  networkId?: string;
  isNative?: boolean;
};

export function resolveSwapToTokenMarketDetail(
  token: ISwapToken | undefined,
): ISwapToTokenMarketDetail | undefined {
  if (!token || token.isStock) {
    return undefined;
  }
  const symbol = token.symbol.trim();
  const networkId = token.networkId.trim();
  const tokenAddress = token.contractAddress.trim();
  if (!symbol || !networkId || (!tokenAddress && !token.isNative)) {
    return undefined;
  }
  return {
    tokenAddress,
    address: tokenAddress,
    networkId,
    symbol,
    name: token.name?.trim() || symbol,
    decimals: token.decimals,
    isNative: token.isNative,
    tokenImageUri: token.logoURI,
  };
}

export function resolveSwapStockMarketDetailTarget(
  token: ISwapToken | undefined,
): ISwapStockMarketDetailTarget | undefined {
  if (!token?.isStock) {
    return undefined;
  }
  const stockId = resolveMarketStockId(token);
  if (!stockId) {
    return undefined;
  }
  const tokenAddress = token.contractAddress.trim();
  const networkId = token.networkId.trim();
  // The wrapped token's symbol and logo are the issuer's, not the listing's.
  return {
    stockId,
    symbol: stockId,
    name: token.stock?.underlyingAssetName?.trim() || stockId,
    logoUrl: '',
    ...(tokenAddress ? { tokenAddress } : undefined),
    ...(networkId ? { networkId } : undefined),
    isNative: token.isNative,
  };
}

export function resolveSwapHeaderMarketDetail(
  ...tokens: (ISwapToken | undefined)[]
):
  | { kind: 'token'; target: ISwapToTokenMarketDetail }
  | { kind: 'stock'; target: ISwapStockMarketDetailTarget }
  | undefined {
  const token = resolveSwapHeaderMarketToken(...tokens);
  if (token?.isStock) {
    const target = resolveSwapStockMarketDetailTarget(token);
    return target ? { kind: 'stock', target } : undefined;
  }
  const target = resolveSwapToTokenMarketDetail(token);
  return target ? { kind: 'token', target } : undefined;
}

export function resolveSwapHeaderMarketToken(
  ...tokens: (ISwapToken | undefined)[]
): ISwapToken | undefined {
  return tokens.find(
    (token) =>
      token &&
      token.symbol.trim() &&
      token.networkId.trim() &&
      (token.contractAddress.trim() || token.isNative),
  );
}
