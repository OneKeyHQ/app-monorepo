import BigNumber from 'bignumber.js';
import { isEqual } from 'lodash';

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
  MarketUnavailable = 'marketUnavailable',
  InitializingPayToken = 'initializingPayToken',
  MissingPayToken = 'missingPayToken',
  Ready = 'ready',
}

export enum ESwapStockTradeSide {
  Buy = 'buy',
  Sell = 'sell',
}

export const SWAP_STOCK_PAY_TOKEN_SCOPE_CACHE_MAX_ENTRIES = 20;

export function upsertSwapStockPayTokenScopeCache<T>({
  cache,
  scope,
  value,
}: {
  cache: Record<string, T>;
  scope: string;
  value: T;
}): Record<string, T> {
  const entries = Object.entries(cache).filter(([key]) => key !== scope);
  entries.push([scope, value]);
  return Object.fromEntries(
    entries.slice(-SWAP_STOCK_PAY_TOKEN_SCOPE_CACHE_MAX_ENTRIES),
  );
}

export function resolveStockExecutionTokensForTradeSideSwitch({
  payToken,
  stockToken,
}: {
  payToken?: ISwapToken;
  stockToken?: ISwapToken;
}): { payToken: ISwapToken; stockToken: ISwapToken } | undefined {
  if (!payToken || !stockToken) {
    return undefined;
  }
  return { payToken, stockToken };
}

export function resolveStockExecutionTokensToSync({
  currentFromToken,
  currentToToken,
  payToken,
  readyForQuote,
  stockToken,
  tradeSide,
}: {
  currentFromToken?: ISwapToken;
  currentToToken?: ISwapToken;
  payToken?: ISwapToken;
  readyForQuote: boolean;
  stockToken?: ISwapToken;
  tradeSide: ESwapStockTradeSide;
}): { fromToken: ISwapToken; toToken: ISwapToken } | undefined {
  if (!readyForQuote) {
    return undefined;
  }
  const fromToken =
    tradeSide === ESwapStockTradeSide.Buy ? payToken : stockToken;
  const toToken = tradeSide === ESwapStockTradeSide.Buy ? stockToken : payToken;
  if (!stockToken || !fromToken || !toToken) {
    return undefined;
  }
  const executionPairSynced =
    equalTokenNoCaseSensitive({
      token1: currentFromToken,
      token2: fromToken,
    }) &&
    equalTokenNoCaseSensitive({
      token1: currentToToken,
      token2: toToken,
    });
  const currentStockToken =
    tradeSide === ESwapStockTradeSide.Buy ? currentToToken : currentFromToken;
  const stockExecutionMetadataSynced =
    currentStockToken?.decimals === stockToken.decimals &&
    Boolean(currentStockToken?.isStock) === Boolean(stockToken.isStock);
  return executionPairSynced && stockExecutionMetadataSynced
    ? undefined
    : { fromToken, toToken };
}

/**
 * A closed/paused market no longer blocks quoting (OK-58986): providers keep
 * serving on-chain liquidity outside US sessions, so the quote response — not
 * a prediction here — decides whether the token can trade.
 */
export function isStockTradeReadyForQuote({
  currentStockToken,
  marketStatusStatus,
  payToken,
  payTokenStatus,
  stockTokenStatus,
}: {
  currentStockToken?: ISwapToken;
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
    payTokenStatus === ESwapStockChannelAsyncStatus.Ready,
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

export function buildStockPayTokenDisplaySeed(token: ISwapToken): ISwapToken {
  return {
    networkId: token.networkId,
    contractAddress: token.contractAddress,
    decimals: token.decimals,
    isNative: token.isNative,
    symbol: token.symbol,
    name: token.name,
    logoURI: token.logoURI,
    networkLogoURI: token.networkLogoURI,
  };
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

export function resolveSwapStockDefaultTokenStatus({
  hasSelectableToken,
  hasStockCategory,
  isLoading,
  marketBasicConfigLoading,
  requestScope,
  resultScope,
  shouldLoad,
}: {
  hasSelectableToken: boolean;
  hasStockCategory: boolean;
  isLoading?: boolean;
  marketBasicConfigLoading?: boolean;
  requestScope: string;
  resultScope: string;
  shouldLoad: boolean;
}) {
  if (!shouldLoad) {
    return ESwapStockChannelAsyncStatus.Idle;
  }

  if (marketBasicConfigLoading !== false) {
    return ESwapStockChannelAsyncStatus.Initializing;
  }

  if (!hasStockCategory) {
    return ESwapStockChannelAsyncStatus.Empty;
  }

  if (
    isLoading !== false ||
    !requestScope ||
    resultScope !== requestScope ||
    hasSelectableToken
  ) {
    return ESwapStockChannelAsyncStatus.Initializing;
  }

  return ESwapStockChannelAsyncStatus.Empty;
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
    stock: token.stock,
  };
}

function mergeStockExecutionMetadata({
  currentStock,
  tokenDetailStock,
}: {
  currentStock: ISwapToken['stock'];
  tokenDetailStock: ISwapToken['stock'];
}): ISwapToken['stock'] {
  if (!currentStock || !tokenDetailStock) {
    return tokenDetailStock ?? currentStock;
  }

  const mergedStock = { ...currentStock };
  Object.entries(tokenDetailStock).forEach(([key, value]) => {
    if (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && !value.trim())
    ) {
      return;
    }
    Object.assign(mergedStock, { [key]: value });
  });

  return isEqual(mergedStock, currentStock) ? currentStock : mergedStock;
}

export function resolveStockExecutionTokenMetadata({
  token,
  tokenDetail,
}: {
  token?: ISwapToken;
  tokenDetail?: ISwapToken;
}): ISwapToken | undefined {
  if (
    !token ||
    !tokenDetail ||
    !equalTokenNoCaseSensitive({
      token1: token,
      token2: tokenDetail,
    })
  ) {
    return undefined;
  }
  const isNative = tokenDetail.isNative ?? token.isNative;
  const stock = mergeStockExecutionMetadata({
    currentStock: token.stock,
    tokenDetailStock: tokenDetail.stock,
  });
  if (
    token.decimals === tokenDetail.decimals &&
    token.isNative === isNative &&
    token.isStock === true &&
    token.stock === stock
  ) {
    return token;
  }
  return {
    ...token,
    decimals: tokenDetail.decimals,
    isNative,
    isStock: true,
    stock,
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
    stock: token.stock,
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

export function resolveStockPayTokenState({
  channelToken,
  coldStartToken,
  liveToken,
  stockPairToken,
  swapPairToken,
}: {
  channelToken?: ISwapToken;
  coldStartToken?: ISwapToken;
  liveToken?: ISwapToken;
  stockPairToken?: ISwapToken;
  swapPairToken?: ISwapToken;
}) {
  const stockOwnedToken = channelToken ?? stockPairToken ?? coldStartToken;
  return {
    displayToken: liveToken ?? stockOwnedToken,
    selectionToken: stockOwnedToken ?? swapPairToken,
  };
}

export function resolveStockTradeInputTokenStatus({
  isBuySide,
  payTokenStatus,
  stockTokenStatus,
}: {
  isBuySide: boolean;
  payTokenStatus: ESwapStockChannelAsyncStatus;
  stockTokenStatus: ESwapStockChannelAsyncStatus;
}) {
  if (!isBuySide) {
    return stockTokenStatus;
  }
  if (stockTokenStatus === ESwapStockChannelAsyncStatus.Empty) {
    return ESwapStockChannelAsyncStatus.Empty;
  }
  if (
    stockTokenStatus !== ESwapStockChannelAsyncStatus.Ready ||
    payTokenStatus === ESwapStockChannelAsyncStatus.Idle
  ) {
    return ESwapStockChannelAsyncStatus.Initializing;
  }
  return payTokenStatus;
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

export function isStockBalanceActionReady({
  authoritativeBalance,
  authoritativeStockToken,
  isBuySide,
}: {
  authoritativeBalance?: string;
  authoritativeStockToken?: ISwapToken;
  isBuySide: boolean;
}) {
  return Boolean(
    authoritativeBalance !== undefined &&
    (isBuySide || authoritativeStockToken),
  );
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

export function hasValidStockBalanceForTrade(balance?: string) {
  if (!balance) {
    return false;
  }
  const balanceBN = new BigNumber(balance);
  return balanceBN.isFinite() && balanceBN.gte(0);
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

export function resolveStockBalanceViewState({
  authoritativeBalance,
  balanceSnapshot,
  cachedDisplayBalance,
}: {
  authoritativeBalance?: string;
  balanceSnapshot?: IStockBalanceSnapshot;
  cachedDisplayBalance?: string;
}) {
  return {
    balance: authoritativeBalance,
    displayBalance: balanceSnapshot?.balance ?? cachedDisplayBalance,
    tokenDetail: balanceSnapshot?.tokenDetail,
  };
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

export function resolveStockPayTokenDisplaySeed({
  allowPersistedTokenFallback,
  balances,
  candidates,
  persistedToken,
  persistedTokenKey,
  selectedToken,
}: {
  allowPersistedTokenFallback?: boolean;
  balances?: Record<string, string | undefined>;
  candidates: IToken[];
  persistedToken?: ISwapToken;
  persistedTokenKey?: string;
  selectedToken?: Partial<ISwapTokenBase>;
}) {
  const selectedCandidate = findTokenFromCandidates({
    candidates,
    token: selectedToken,
  });
  if (selectedCandidate) {
    return selectedCandidate;
  }

  const persistedCandidate = persistedTokenKey
    ? candidates.find(
        (candidate) => getTokenIdentityKey(candidate) === persistedTokenKey,
      )
    : undefined;
  const persistedDisplayCandidate = findTokenFromCandidates({
    candidates,
    token: persistedToken,
  });
  const coldStartDisplaySeed =
    allowPersistedTokenFallback && candidates.length === 0 && persistedToken
      ? filterStockPayTokenCandidates([persistedToken])[0]
      : undefined;
  return (
    persistedCandidate ??
    persistedDisplayCandidate ??
    coldStartDisplaySeed ??
    findDefaultStockPayToken({
      candidates,
      balances,
    })
  );
}
