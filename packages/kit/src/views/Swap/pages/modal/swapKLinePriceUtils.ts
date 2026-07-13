import type { ITradingViewPriceUpdateData } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

export const SWAP_KLINE_CHART_PRICE_FRESHNESS_MS = 10_000;

export type ISwapKLineChartRealtimePrice = {
  tokenKey: string;
  price: string;
  updatedAt: number;
  receivedAt: number;
};

export function getNormalizedSwapKLineValueText(
  value?: number | string | null,
) {
  const normalized = typeof value === 'number' ? String(value) : value?.trim();
  if (!normalized) {
    return undefined;
  }
  const numericValue = Number(normalized);
  if (!Number.isFinite(numericValue)) {
    return undefined;
  }
  return normalized;
}

export function getNormalizedSwapKLinePrice(value?: number | string | null) {
  const normalized = getNormalizedSwapKLineValueText(value);
  if (!normalized) {
    return undefined;
  }
  const numericValue = Number(normalized);
  if (numericValue === 0) {
    return undefined;
  }
  return normalized;
}

export function getNormalizedSwapKLinePercent(value?: number | string | null) {
  return getNormalizedSwapKLineValueText(value);
}

function getNormalizedTokenAddress(address?: string) {
  return address?.trim().toLowerCase() ?? '';
}

function getNormalizedTokenSymbol(symbol?: string) {
  return symbol?.trim().toUpperCase() ?? '';
}

export function isSwapKLineChartPriceUpdateForToken({
  data,
  token,
}: {
  data: ITradingViewPriceUpdateData;
  token: ISwapToken;
}) {
  if (data.networkId && data.networkId !== token.networkId) {
    return false;
  }

  const currentTokenAddress = getNormalizedTokenAddress(token.contractAddress);
  const updateTokenAddress = getNormalizedTokenAddress(data.tokenAddress);
  if (updateTokenAddress) {
    return currentTokenAddress
      ? updateTokenAddress === currentTokenAddress
      : false;
  }

  const currentSymbol = getNormalizedTokenSymbol(token.symbol);
  const updateSymbol = getNormalizedTokenSymbol(data.symbol);
  if (updateSymbol && currentSymbol) {
    return updateSymbol === currentSymbol;
  }

  return false;
}

export function normalizeSwapKLineChartUpdateTimestamp(
  timestamp?: number,
  fallbackUpdatedAt = Date.now(),
) {
  if (
    typeof timestamp !== 'number' ||
    !Number.isFinite(timestamp) ||
    timestamp <= 0
  ) {
    return fallbackUpdatedAt;
  }

  return timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
}

export function getSwapKLineDisplayPrice({
  tokenMarketDetail,
  tokenMarketDetailUpdatedAt,
  tokenUsdFallbackPrice,
  tokenUsdFallbackPriceUpdatedAt,
  chartRealtimePrice,
  now = Date.now(),
}: {
  tokenMarketDetail?: IMarketTokenDetail;
  tokenMarketDetailUpdatedAt?: number;
  tokenUsdFallbackPrice?: string;
  tokenUsdFallbackPriceUpdatedAt?: number;
  chartRealtimePrice?: ISwapKLineChartRealtimePrice;
  now?: number;
}) {
  const chartPrice = getNormalizedSwapKLinePrice(chartRealtimePrice?.price);
  const chartPriceReceivedAt = chartRealtimePrice?.receivedAt;
  const hasFreshChartPrice =
    chartPrice &&
    typeof chartPriceReceivedAt === 'number' &&
    Number.isFinite(chartPriceReceivedAt) &&
    now - chartPriceReceivedAt < SWAP_KLINE_CHART_PRICE_FRESHNESS_MS;

  if (hasFreshChartPrice) {
    return chartPrice;
  }

  const candidates = [
    {
      price: getNormalizedSwapKLinePrice(tokenMarketDetail?.price),
      updatedAt: tokenMarketDetailUpdatedAt ?? 0,
    },
    {
      price: getNormalizedSwapKLinePrice(tokenUsdFallbackPrice),
      updatedAt: tokenUsdFallbackPriceUpdatedAt ?? 0,
    },
    {
      price: chartPrice,
      updatedAt: chartRealtimePrice?.updatedAt ?? 0,
    },
  ].filter((item): item is { price: string; updatedAt: number } =>
    Boolean(item.price),
  );

  return candidates.toSorted((a, b) => b.updatedAt - a.updatedAt)[0]?.price;
}
