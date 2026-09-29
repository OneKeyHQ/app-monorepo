import BigNumber from 'bignumber.js';

import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';
import type {
  IMarketStockInfo,
  IMarketStockTokenVariant,
} from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  ESwapStockChannelStage,
  ESwapStockTradeSide,
} from '../../hooks/swapStockChannelUtils';
import { normalizeSwapKLineWalletChartTimestamp } from '../modal/swapKLineChartUtils';

export type IStockChartRange = '1D' | '1W' | '1M' | '1Y';

export const STOCK_CHART_DEFAULT_RANGE: IStockChartRange = '1W';

export const STOCK_DESKTOP_HEADER_SLOT_PROPS = {
  width: '100%',
  alignItems: 'center',
  pt: '$8',
  pb: '$4',
} as const;

export type IStockChartCoinGeckoIdLookupResult = {
  cacheable?: boolean;
  tokenScope: string;
  coinGeckoId?: string;
};

export const STOCK_CHART_RANGE_ITEMS: {
  label: IStockChartRange;
  interval: string;
  seconds: number;
}[] = [
  { label: '1D', interval: '1m', seconds: 24 * 60 * 60 },
  { label: '1W', interval: '1H', seconds: 7 * 24 * 60 * 60 },
  { label: '1M', interval: '4H', seconds: 30 * 24 * 60 * 60 },
  { label: '1Y', interval: '1D', seconds: 365 * 24 * 60 * 60 },
];

export function getStockNetworkLogoUri({
  networkId,
  networkLogoUri,
}: {
  networkId?: string;
  networkLogoUri?: string;
}) {
  if (networkLogoUri) {
    return networkLogoUri;
  }
  return networkId
    ? networkUtils.getLocalNetworkInfo(networkId)?.logoURI
    : undefined;
}

export function getStockChartCoinGeckoIdState({
  lookupResult,
  networkId,
  tokenDetailCoinGeckoId,
  tokenScope,
}: {
  lookupResult?: IStockChartCoinGeckoIdLookupResult;
  networkId?: string;
  tokenDetailCoinGeckoId?: string;
  tokenScope: string;
}) {
  const currentLookupResult =
    lookupResult?.tokenScope === tokenScope ? lookupResult : undefined;
  return {
    coinGeckoId:
      tokenDetailCoinGeckoId || currentLookupResult?.coinGeckoId || undefined,
    isLoading: Boolean(
      networkId && !tokenDetailCoinGeckoId && !currentLookupResult,
    ),
  };
}

export function isStockChartRequestReady({
  chartCacheReady,
  coinGeckoIdLoading,
}: {
  chartCacheReady: boolean;
  coinGeckoIdLoading: boolean;
}) {
  return chartCacheReady && !coinGeckoIdLoading;
}

export function getStockDisabledActionButtonProps(
  tradeSide: ESwapStockTradeSide,
  channelStage: ESwapStockChannelStage,
) {
  if (channelStage === ESwapStockChannelStage.CheckingMarketStatus) {
    return undefined;
  }

  return {
    bg:
      tradeSide === ESwapStockTradeSide.Sell
        ? '$bgCriticalStrong'
        : '$bgSuccessStrong',
    color: '$textOnColor',
    disabledStyle: {
      opacity: 0.6,
    },
  } as const;
}

export function isStockMarketPanelLoadingStage(
  channelStage: ESwapStockChannelStage,
) {
  return (
    channelStage === ESwapStockChannelStage.InitializingStock ||
    channelStage === ESwapStockChannelStage.CheckingMarketStatus
  );
}

export function shouldDeferStockInitialContent({
  channelStage,
  startedWithoutContent,
}: {
  channelStage: ESwapStockChannelStage;
  startedWithoutContent: boolean;
}) {
  return (
    startedWithoutContent &&
    (isStockMarketPanelLoadingStage(channelStage) ||
      channelStage === ESwapStockChannelStage.InitializingPayToken)
  );
}

export function shouldResetStockTradeQuoteState({
  identityLoading,
  previousIdentityLoading,
}: {
  identityLoading: boolean;
  previousIdentityLoading: boolean;
}) {
  return identityLoading && !previousIdentityLoading;
}

export function shouldShowStockMarketHeaderSkeleton({
  channelStage,
  hasStockIdentity,
}: {
  channelStage: ESwapStockChannelStage;
  hasStockIdentity: boolean;
}) {
  return (
    !hasStockIdentity &&
    channelStage === ESwapStockChannelStage.InitializingStock
  );
}

export function shouldShowStockMarketTokenLabelsSkeleton({
  channelStage,
  hasTokenData,
}: {
  channelStage: ESwapStockChannelStage;
  hasTokenData: boolean;
}) {
  return (
    !hasTokenData &&
    channelStage === ESwapStockChannelStage.CheckingMarketStatus
  );
}

export function resolveSelectedVariantStock({
  sameToken,
  currentStock,
  detailStock,
}: {
  sameToken: boolean;
  currentStock?: IMarketStockInfo;
  detailStock?: IMarketStockInfo;
}) {
  if (detailStock) {
    return detailStock;
  }
  if (sameToken) {
    return currentStock;
  }
  return undefined;
}

export function buildSwapTokenFromStockVariant({
  decimals,
  stock,
  variant,
}: {
  decimals: number;
  stock?: IMarketStockInfo;
  variant: IMarketStockTokenVariant;
}): ISwapToken {
  return {
    networkId: variant.networkId,
    contractAddress: variant.contractAddress,
    decimals,
    symbol: variant.symbol?.trim() || stock?.underlyingAssetTicker || '',
    name: variant.name,
    logoURI: variant.logoUrl,
    networkLogoURI: variant.networkLogoUrl,
    isNative: false,
    isStock: true,
    price: variant.price,
    currency: variant.currency,
    stock: {
      ...stock,
      subtitle: stock?.subtitle ?? '',
      source: variant.issuer || stock?.source,
      sourceLogoUri: variant.issuerLogoUrl || stock?.sourceLogoUri || '',
      tokenToAssetRatio: variant.tokenToAssetRatio ?? stock?.tokenToAssetRatio,
    },
  };
}

const STOCK_ISSUER_LABELS: Record<string, string> = {
  // cspell:disable-next-line
  bstocks: 'bStocks',
  ondo: 'Ondo',
  // cspell:disable-next-line
  xstock: 'xStocks',
  // cspell:disable-next-line
  xstocks: 'xStocks',
};

export function resolveStockListingId({
  stockId,
  underlyingAssetTicker,
}: {
  stockId?: string;
  underlyingAssetTicker?: string;
}) {
  return stockId?.trim() || underlyingAssetTicker?.trim() || undefined;
}

export function isCurrentStockVariantSelection(
  requestId: number,
  latestRequestId: number,
) {
  return requestId === latestRequestId;
}

export function getStockVariantOptionsPhase({
  isLoading,
  itemCount,
  resultStockId,
  stockId,
}: {
  isLoading: boolean | undefined;
  itemCount: number;
  resultStockId?: string;
  stockId?: string;
}): 'loading' | 'empty' | 'ready' {
  if (!stockId) {
    return 'empty';
  }
  const matchesStock = resultStockId === stockId;
  if (!matchesStock || (isLoading !== false && itemCount === 0)) {
    return 'loading';
  }
  if (itemCount === 0) {
    return 'empty';
  }
  return 'ready';
}

export function resolveStockVariantRowLabel({
  detailName,
  detailSymbol,
  tokenName,
  tokenSymbol,
}: {
  detailName?: string;
  detailSymbol?: string;
  tokenName?: string;
  tokenSymbol?: string;
}) {
  return (
    detailSymbol?.trim() ||
    tokenSymbol?.trim() ||
    detailName?.trim() ||
    tokenName?.trim() ||
    ''
  );
}

export function formatStockIssuerLabel(issuer?: string) {
  const normalizedIssuer = issuer?.trim() ?? '';
  if (!normalizedIssuer) {
    return undefined;
  }
  return (
    STOCK_ISSUER_LABELS[normalizedIssuer.toLowerCase()] ?? normalizedIssuer
  );
}

function stockIdsMatch(left?: string, right?: string) {
  const normalizedLeft = left?.trim().toUpperCase();
  const normalizedRight = right?.trim().toUpperCase();
  return Boolean(
    normalizedLeft && normalizedRight && normalizedLeft === normalizedRight,
  );
}

export function resolveSwapStockMobileHeaderIdentity({
  companyName,
  listingName,
  listingSymbol,
  listingStockId,
  loadedStockId,
  tokenSymbol,
  underlyingName,
  underlyingTicker,
}: {
  companyName?: string;
  listingName?: string;
  listingSymbol?: string;
  listingStockId?: string;
  loadedStockId?: string;
  tokenSymbol?: string;
  underlyingName?: string;
  underlyingTicker?: string;
}) {
  const hasListingRequest = Boolean(listingStockId?.trim());
  const listingMatches =
    !hasListingRequest || stockIdsMatch(listingStockId, loadedStockId);
  const symbol =
    (listingMatches ? listingSymbol?.trim() : '') ||
    underlyingTicker?.trim() ||
    tokenSymbol?.trim() ||
    '';
  const resolvedCompanyName =
    (listingMatches ? listingName?.trim() : '') ||
    underlyingName?.trim() ||
    companyName?.trim();
  return {
    symbol,
    companyName:
      resolvedCompanyName && resolvedCompanyName !== symbol
        ? resolvedCompanyName
        : undefined,
  };
}

export function resolveSwapStockMobileHeaderLogo({
  listingLogoUrl,
  listingStockId,
  loadedStockId,
}: {
  listingLogoUrl?: string;
  listingStockId?: string;
  loadedStockId?: string;
}) {
  if (!stockIdsMatch(listingStockId, loadedStockId)) {
    return undefined;
  }
  return listingLogoUrl?.trim() || undefined;
}

export function shouldShowSwapStockMobileHeaderLogoSkeleton({
  hasListingLogo,
  listingStockId,
  listingStockLoading,
}: {
  hasListingLogo: boolean;
  listingStockId?: string;
  listingStockLoading?: boolean;
}) {
  return (
    Boolean(listingStockId?.trim()) &&
    !hasListingLogo &&
    listingStockLoading !== false
  );
}

export function getStockMarketTokenSubtitle({
  currentStockSubtitle,
  tokenDetailStockSubtitle,
  tokenDetailStockUnderlyingAssetName,
}: {
  currentStockSubtitle?: string;
  tokenDetailStockSubtitle?: string;
  tokenDetailStockUnderlyingAssetName?: string;
}) {
  if (tokenDetailStockSubtitle?.trim()) {
    return tokenDetailStockSubtitle;
  }
  if (currentStockSubtitle?.trim()) {
    return currentStockSubtitle;
  }
  return tokenDetailStockUnderlyingAssetName?.trim() || undefined;
}

export function shouldShowStockQuoteActionLoading({
  inputAmount,
  quoteEventCompleted,
  quoteRequestMatchesStockTrade,
}: {
  inputAmount: string;
  quoteEventCompleted: boolean;
  quoteRequestMatchesStockTrade: boolean;
}) {
  if (!new BigNumber(inputAmount || 0).gt(0)) {
    return false;
  }

  if (!quoteEventCompleted) {
    return true;
  }

  return !quoteRequestMatchesStockTrade;
}

export function mergeStockChartRealtimePoint({
  baseChartData,
  realtimeChartPoint,
}: {
  baseChartData: IMarketTokenChart;
  realtimeChartPoint?: IMarketTokenChart[number];
}): IMarketTokenChart {
  if (baseChartData.length === 0 || !realtimeChartPoint) {
    return baseChartData;
  }

  const [timestamp, price] = realtimeChartPoint;
  const normalizedTimestamp = normalizeSwapKLineWalletChartTimestamp(timestamp);
  const normalizedPrice = Number(price);
  if (
    !Number.isFinite(normalizedTimestamp) ||
    !Number.isFinite(normalizedPrice)
  ) {
    return baseChartData;
  }

  const pointsByTimestamp = new Map<number, number>();
  for (const [pointTimestamp, pointPrice] of baseChartData) {
    const normalizedPointTimestamp =
      normalizeSwapKLineWalletChartTimestamp(pointTimestamp);
    const normalizedPointPrice = Number(pointPrice);
    if (
      Number.isFinite(normalizedPointTimestamp) &&
      Number.isFinite(normalizedPointPrice)
    ) {
      pointsByTimestamp.set(normalizedPointTimestamp, normalizedPointPrice);
    }
  }
  pointsByTimestamp.set(normalizedTimestamp, normalizedPrice);

  return Array.from(pointsByTimestamp.entries()).toSorted(
    (a, b) => a[0] - b[0],
  );
}

export function getStockChartDisplayState({
  baseChartData,
  isChartStateForCurrentScope,
  isLoading,
  requestStatus,
  realtimeChartPoint,
}: {
  baseChartData: IMarketTokenChart;
  isChartStateForCurrentScope: boolean;
  isLoading?: boolean;
  requestStatus?: 'pending' | 'success' | 'error';
  realtimeChartPoint?: IMarketTokenChart[number];
}) {
  const shouldShowChartError =
    baseChartData.length === 0 &&
    isChartStateForCurrentScope &&
    !isLoading &&
    requestStatus === 'error';
  return {
    chartData: mergeStockChartRealtimePoint({
      baseChartData,
      realtimeChartPoint: isChartStateForCurrentScope
        ? realtimeChartPoint
        : undefined,
    }),
    shouldShowChartError,
    shouldShowChartLoading:
      baseChartData.length === 0 &&
      !shouldShowChartError &&
      (requestStatus === 'pending' ||
        Boolean(isLoading) ||
        !isChartStateForCurrentScope),
  };
}
