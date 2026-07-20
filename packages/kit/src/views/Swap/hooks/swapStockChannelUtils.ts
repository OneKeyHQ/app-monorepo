import BigNumber from 'bignumber.js';

import type { IToken } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/types';
import type { IMarketToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { equalsIgnoreCase } from '@onekeyhq/shared/src/utils/stringUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IMarketTokenDetail,
  IMarketTokenListItem,
} from '@onekeyhq/shared/types/marketV2';
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

export function isStockTradeReadyForQuote({
  currentStockToken,
  marketOpen,
  marketStatusStatus,
  payToken,
  payTokenStatus,
  stockTokenStatus,
}: {
  currentStockToken?: ISwapToken;
  marketOpen?: boolean;
  marketStatusStatus: ESwapStockChannelAsyncStatus;
  payToken?: ISwapToken;
  payTokenStatus: ESwapStockChannelAsyncStatus;
  stockTokenStatus: ESwapStockChannelAsyncStatus;
}) {
  return Boolean(
    currentStockToken &&
    payToken &&
    stockTokenStatus === ESwapStockChannelAsyncStatus.Ready &&
    marketStatusStatus !== ESwapStockChannelAsyncStatus.Initializing &&
    payTokenStatus === ESwapStockChannelAsyncStatus.Ready &&
    marketOpen !== false,
  );
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

export function shouldResetStockTradeReceiveAmount({
  nextStockToken,
  previousStockToken,
  resetReceiveAmount,
}: {
  nextStockToken?: Partial<ISwapTokenBase>;
  previousStockToken?: Partial<ISwapTokenBase>;
  resetReceiveAmount?: boolean;
}) {
  const previousStockTokenKey = getTokenIdentityKey(previousStockToken);
  const nextStockTokenKey = getTokenIdentityKey(nextStockToken);
  return Boolean(
    resetReceiveAmount &&
    previousStockTokenKey &&
    nextStockTokenKey &&
    previousStockTokenKey !== nextStockTokenKey,
  );
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

// Pro select tokens persisted before the isStock field existed restore with
// the flag missing, which would silently bypass every stock stable-coin rule.
// Backfill the identity from the authoritative market detail once it matches
// the token (stale/late details for another token are ignored); returns the
// original reference when nothing needs to change so callers can cheaply
// detect the migration case.
export function backfillSwapProTokenStockIdentity<T extends ISwapTokenBase>({
  token,
  tokenDetail,
}: {
  token?: T;
  tokenDetail?: IMarketTokenDetail;
}): T | undefined {
  if (!token || !tokenDetail) {
    return token;
  }
  const detailMatchesToken = equalTokenNoCaseSensitive({
    token1: {
      networkId: tokenDetail.networkId,
      contractAddress: tokenDetail.address,
    },
    token2: token,
  });
  if (!detailMatchesToken) {
    return token;
  }
  const isStock = Boolean(tokenDetail.stock);
  // A missing field still gets the explicit flag written once, so the
  // migration persists instead of re-deriving forever.
  if (token.isStock !== undefined && Boolean(token.isStock) === isStock) {
    return token;
  }
  return { ...token, isStock };
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

export function resolveStockKLineToken({
  stockSelectedToken,
  executionFromToken,
  executionToToken,
  fromToken,
  toToken,
}: {
  stockSelectedToken?: ISwapToken;
  executionFromToken?: ISwapToken;
  executionToToken?: ISwapToken;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
}) {
  if (stockSelectedToken?.isStock) {
    return stockSelectedToken;
  }

  return (
    resolveStockChannelSwapPair({
      fromToken: executionFromToken,
      toToken: executionToToken,
    }).stockToken ??
    resolveStockChannelSwapPair({
      fromToken,
      toToken,
    }).stockToken
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

export function isStockPayTokenReadyForTradeInput({
  payToken,
  payTokenStatus,
  selectablePayTokens,
  stockIdentityReady,
}: {
  payToken?: Partial<ISwapTokenBase>;
  payTokenStatus: ESwapStockChannelAsyncStatus;
  selectablePayTokens: IToken[];
  stockIdentityReady: boolean;
}) {
  return Boolean(
    stockIdentityReady &&
    payToken &&
    payTokenStatus === ESwapStockChannelAsyncStatus.Ready &&
    findTokenFromCandidates({
      candidates: selectablePayTokens,
      token: payToken,
    }),
  );
}

export function shouldRenderStockTradeInputSkeleton({
  inputTokenStatus,
  inputTokenReady,
  inputTokenVisible,
  isBuySide,
}: {
  inputTokenStatus: ESwapStockChannelAsyncStatus;
  inputTokenReady: boolean;
  inputTokenVisible: boolean;
  isBuySide: boolean;
}) {
  if (inputTokenStatus !== ESwapStockChannelAsyncStatus.Initializing) {
    return false;
  }
  return isBuySide ? !inputTokenVisible : !inputTokenReady;
}

export function isStockBalanceInitializing({
  balance,
  requestPending,
}: {
  balance?: string;
  requestPending: boolean;
}) {
  return balance === undefined && requestPending;
}

export function resolveStockBalanceSeed({
  hasActiveAccount,
  networkAccountAddress,
  token,
}: {
  hasActiveAccount: boolean;
  networkAccountAddress?: string;
  token?: ISwapToken;
}) {
  if (token?.balanceParsed === undefined) {
    return undefined;
  }
  if (!hasActiveAccount) {
    return token.balanceParsed;
  }
  if (
    !token.accountAddress ||
    !networkAccountAddress ||
    !equalsIgnoreCase(token.accountAddress, networkAccountAddress)
  ) {
    return undefined;
  }
  return token.balanceParsed;
}

export type IStockBalanceSnapshot = {
  ownerScope: string;
  balance: string;
  tokenDetail?: ISwapToken;
};

export function resolveStockBalanceSnapshot({
  authoritativeBalance,
  authoritativeTokenDetail,
  ownerScope,
  previousSnapshot,
  seededBalance,
  seededTokenDetail,
}: {
  authoritativeBalance?: string;
  authoritativeTokenDetail?: ISwapToken;
  ownerScope: string;
  previousSnapshot?: IStockBalanceSnapshot;
  seededBalance?: string;
  seededTokenDetail?: ISwapToken;
}): IStockBalanceSnapshot | undefined {
  if (authoritativeBalance !== undefined) {
    return {
      ownerScope,
      balance: authoritativeBalance,
      tokenDetail: authoritativeTokenDetail,
    };
  }
  if (previousSnapshot?.ownerScope === ownerScope) {
    return previousSnapshot;
  }
  if (seededBalance !== undefined) {
    return {
      ownerScope,
      balance: seededBalance,
      tokenDetail: seededTokenDetail,
    };
  }
  return undefined;
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
