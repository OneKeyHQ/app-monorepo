import BigNumber from 'bignumber.js';

import type { IToken } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/types';
import type { IMarketToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
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

type IStockMarketDetailIdentity = {
  address?: string;
  isNative?: boolean;
  networkId?: string;
  stock?: unknown;
};

function buildUsdPriceFields(price?: number | string) {
  if (price === undefined || price === null || price === '') {
    return {};
  }
  return {
    price: price.toString(),
    currency: USD_CURRENCY_ID,
  };
}

export function getTokenIdentityKey(token?: Partial<ISwapTokenBase>) {
  const networkId = token?.networkId;
  if (!networkId || (!token.contractAddress && !token.isNative)) {
    return '';
  }
  return `${networkId}:${token.contractAddress ?? ''}:${
    token.isNative ? 'native' : 'token'
  }`;
}

export function getMarketPresetTokenKey(token?: IMarketPresetTokenContext) {
  return getTokenIdentityKey(token);
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
    ...buildUsdPriceFields(token.price),
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
    ...buildUsdPriceFields(token.price),
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
  const resolvedTokenAddress = tokenAddress || tokenDetail?.address;
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
    isNative: !!(tokenDetail.isNative ?? isNative),
    ...buildUsdPriceFields(tokenDetail.price),
    isStock: Boolean(tokenDetail.stock),
  };
}

export function buildStockSwapTokenFromTokenIdentity(
  token?: Partial<ISwapTokenBase>,
): ISwapToken | undefined {
  if (!token?.networkId || (!token.contractAddress && !token.isNative)) {
    return undefined;
  }

  return {
    networkId: token.networkId,
    contractAddress: token.contractAddress ?? '',
    decimals: token.decimals ?? 0,
    symbol: token.symbol ?? '',
    name: token.name,
    logoURI: token.logoURI,
    isNative: !!token.isNative,
    price: token.price,
    currency: token.currency,
    isStock: true,
  };
}

function normalizeAddress(address?: string) {
  return address?.toLowerCase() ?? '';
}

export function isCurrentStockMarketDetail({
  currentStockToken,
  isNative,
  networkId,
  tokenAddress,
  tokenDetail,
}: {
  currentStockToken?: Partial<ISwapTokenBase>;
  isNative?: boolean;
  networkId?: string;
  tokenAddress?: string;
  tokenDetail?: IStockMarketDetailIdentity;
}) {
  if (!tokenDetail?.stock || !currentStockToken?.networkId) {
    return false;
  }

  const detailNetworkId = tokenDetail.networkId ?? networkId;
  if (!detailNetworkId) {
    return false;
  }

  return (
    detailNetworkId === currentStockToken.networkId &&
    normalizeAddress(tokenAddress || tokenDetail.address) ===
      normalizeAddress(currentStockToken.contractAddress) &&
    Boolean(isNative ?? tokenDetail.isNative) ===
      Boolean(currentStockToken.isNative)
  );
}

export function isStockMarketDetailMatchedTokenParams({
  isNative,
  networkId,
  tokenAddress,
  tokenDetail,
}: {
  isNative?: boolean;
  networkId?: string;
  tokenAddress?: string;
  tokenDetail?: IStockMarketDetailIdentity;
}) {
  if (!tokenDetail?.stock) {
    return false;
  }

  const detailNetworkId = tokenDetail.networkId ?? networkId;
  if (!detailNetworkId) {
    return false;
  }

  if (networkId && detailNetworkId !== networkId) {
    return false;
  }

  if (
    tokenAddress &&
    normalizeAddress(tokenAddress) !== normalizeAddress(tokenDetail.address)
  ) {
    return false;
  }

  if (
    isNative !== undefined &&
    Boolean(isNative) !== Boolean(tokenDetail.isNative)
  ) {
    return false;
  }

  return true;
}

export function resolveStockChannelToken({
  fallbackStockToken,
  stockTokenState,
  marketStockToken,
}: {
  fallbackStockToken?: ISwapToken;
  stockTokenState?: ISwapToken;
  marketStockToken?: ISwapToken;
}) {
  return stockTokenState ?? marketStockToken ?? fallbackStockToken;
}

export function filterStockPayTokenCandidates<
  T extends Partial<ISwapTokenBase>,
>(candidates: T[]) {
  return candidates.filter((candidate) =>
    STOCK_DEFAULT_PAY_SYMBOLS.has(candidate.symbol?.toUpperCase() ?? ''),
  );
}

export function resolveStockExecutionTokenSelection({
  fromToken,
  toToken,
}: {
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
}) {
  if (!fromToken || !toToken) {
    return undefined;
  }
  const isFromTokenPayToken =
    filterStockPayTokenCandidates([fromToken]).length > 0;
  const isToTokenPayToken = filterStockPayTokenCandidates([toToken]).length > 0;

  if (fromToken.isStock && isToTokenPayToken) {
    return {
      tradeSide: ESwapStockTradeSide.Sell,
      stockToken: fromToken,
      payToken: toToken,
    };
  }
  if (toToken.isStock && isFromTokenPayToken) {
    return {
      tradeSide: ESwapStockTradeSide.Buy,
      stockToken: toToken,
      payToken: fromToken,
    };
  }
  return undefined;
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
