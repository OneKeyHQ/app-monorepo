import BigNumber from 'bignumber.js';

import type { IToken } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/types';
import type { IMarketToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IMarketTokenDetail,
  IMarketTokenListItem,
} from '@onekeyhq/shared/types/marketV2';
import type {
  IMarketPresetTokenContext,
  ISwapToken,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';

export enum ESwapStockChannelAsyncStatus {
  Idle = 'idle',
  Initializing = 'initializing',
  Ready = 'ready',
  Empty = 'empty',
}

export enum ESwapStockChannelStage {
  InitializingStock = 'initializingStock',
  MissingStock = 'missingStock',
  CheckingMarketStatus = 'checkingMarketStatus',
  MarketClosed = 'marketClosed',
  MarketUnavailable = 'marketUnavailable',
  InitializingPayToken = 'initializingPayToken',
  MissingPayToken = 'missingPayToken',
  Ready = 'ready',
}

export enum ESwapStockTradeSide {
  Buy = 'buy',
  Sell = 'sell',
}

const STOCK_DEFAULT_PAY_SYMBOLS = new Set(['USDC', 'USDT']);

export function getTokenIdentityKey(token?: Partial<ISwapTokenBase>) {
  if (!token?.networkId) {
    return '';
  }
  return `${token.networkId}:${token.contractAddress ?? ''}:${
    token.isNative ? 'native' : 'token'
  }`;
}

export function getMarketPresetTokenKey(token?: IMarketPresetTokenContext) {
  if (!token?.networkId) {
    return '';
  }
  return `${token.networkId}:${token.contractAddress ?? ''}:${
    token.isNative ? 'native' : 'token'
  }`;
}

export function getMarketListTokenKey(token?: IMarketTokenListItem) {
  const networkId = token?.networkId ?? token?.chainId ?? '';
  if (!networkId || !token) {
    return '';
  }
  return `${networkId}:${token.address}:${token.isNative ? 'native' : 'token'}`;
}

export function buildStockSwapTokenFromMarketToken(
  token: IMarketToken,
): ISwapToken {
  return {
    networkId: token.networkId,
    contractAddress: token.address,
    decimals: token.decimals,
    symbol: token.symbol,
    name: token.name,
    logoURI: token.tokenImageUri,
    networkLogoURI: token.networkLogoUri,
    isNative: !!token.isNative,
    price: token.price ? token.price.toString() : undefined,
    isStock: Boolean(token.stock),
  };
}

export function buildStockSwapTokenFromMarketListToken(
  token: IMarketTokenListItem,
): ISwapToken | undefined {
  const networkId = token.networkId ?? token.chainId;
  if (!networkId) {
    return undefined;
  }
  return {
    networkId,
    contractAddress: token.address,
    decimals: token.decimals,
    symbol: token.symbol,
    name: token.name,
    logoURI: token.logoUrl,
    isNative: !!token.isNative,
    price: token.price,
    isStock: Boolean(token.stock),
  };
}

export function buildStockSwapTokenFromMarketDetail({
  tokenDetail,
  tokenAddress,
  networkId,
  isNative,
}: {
  tokenDetail?: IMarketTokenDetail;
  tokenAddress?: string;
  networkId?: string;
  isNative?: boolean;
}): ISwapToken | undefined {
  const resolvedNetworkId = tokenDetail?.networkId ?? networkId;
  const resolvedTokenAddress = tokenAddress ?? tokenDetail?.address;
  if (!tokenDetail || !resolvedNetworkId || !resolvedTokenAddress) {
    return undefined;
  }
  return {
    networkId: resolvedNetworkId,
    contractAddress: resolvedTokenAddress,
    decimals: tokenDetail.decimals,
    symbol: tokenDetail.symbol,
    name: tokenDetail.name,
    logoURI: tokenDetail.logoUrl,
    isNative: !!(isNative ?? tokenDetail.isNative),
    price: tokenDetail.price ?? tokenDetail.priceConverted,
    isStock: Boolean(tokenDetail.stock),
  };
}

export function resolveStockChannelToken({
  stockTokenState,
  marketStockToken,
}: {
  stockTokenState?: ISwapToken;
  marketStockToken?: ISwapToken;
}) {
  return stockTokenState ?? marketStockToken;
}

export function filterStockPayTokenCandidates<
  T extends Partial<ISwapTokenBase>,
>(candidates: T[]) {
  return candidates.filter((candidate) =>
    STOCK_DEFAULT_PAY_SYMBOLS.has(candidate.symbol?.toUpperCase() ?? ''),
  );
}

export function findTokenFromCandidates({
  candidates,
  token,
}: {
  candidates: IToken[];
  token?: Partial<ISwapTokenBase>;
}) {
  if (!token) {
    return undefined;
  }
  return candidates.find((candidate) =>
    equalTokenNoCaseSensitive({
      token1: candidate,
      token2: token,
    }),
  );
}

function getStockDefaultPayTokenCandidates(candidates: IToken[]) {
  return filterStockPayTokenCandidates(candidates);
}

function getTokenBalanceValue({
  token,
  balances,
}: {
  token: IToken;
  balances?: Record<string, string | undefined>;
}) {
  const balance =
    balances?.[getTokenIdentityKey(token)] ?? token.balanceParsed ?? '0';
  const value = new BigNumber(balance);
  return value.isFinite() ? value : new BigNumber(0);
}

export function findDefaultStockPayToken({
  candidates,
  balances,
}: {
  candidates: IToken[];
  balances?: Record<string, string | undefined>;
}) {
  const preferredCandidates = getStockDefaultPayTokenCandidates(candidates);
  if (balances) {
    let bestToken = preferredCandidates[0];
    let bestBalance = bestToken
      ? getTokenBalanceValue({ token: bestToken, balances })
      : new BigNumber(0);
    for (const token of preferredCandidates.slice(1)) {
      const balance = getTokenBalanceValue({ token, balances });
      if (balance.gt(bestBalance)) {
        bestToken = token;
        bestBalance = balance;
      }
    }
    if (bestToken && bestBalance.gt(0)) {
      return bestToken;
    }
  }
  return preferredCandidates[0];
}
