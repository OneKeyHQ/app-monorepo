import BigNumber from 'bignumber.js';

import type { IToken } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/types';
import type { IMarketToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketTokenListItem } from '@onekeyhq/shared/types/marketV2';
import type {
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
  if (!token?.networkId) {
    return '';
  }
  return `${token.networkId}:${token.contractAddress ?? ''}:${
    token.isNative ? 'native' : 'token'
  }`;
}

export function shouldLoadDefaultStockToken({
  selectedStockTokenKey,
}: {
  selectedStockTokenKey: string;
}) {
  return !selectedStockTokenKey;
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

export function filterStockPayTokenCandidates<
  T extends Partial<ISwapTokenBase>,
>(candidates: T[]) {
  return candidates.filter((candidate) =>
    STOCK_DEFAULT_PAY_SYMBOLS.has(candidate.symbol?.toUpperCase() ?? ''),
  );
}

export function resolveStockChannelSwapPair({
  fromToken,
  toToken,
}: {
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
}) {
  if (fromToken?.isStock) {
    return {
      stockToken: fromToken,
      payToken: filterStockPayTokenCandidates(toToken ? [toToken] : [])[0],
      tradeSide: ESwapStockTradeSide.Sell,
    };
  }
  if (toToken?.isStock) {
    return {
      stockToken: toToken,
      payToken: filterStockPayTokenCandidates(fromToken ? [fromToken] : [])[0],
      tradeSide: ESwapStockTradeSide.Buy,
    };
  }
  return {};
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
