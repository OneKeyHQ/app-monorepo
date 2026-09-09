import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { fetchMarketAssetKLineData } from '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketAssetKLineData';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';
import type { IMarketStockPublicChartPeriod } from '@onekeyhq/shared/types/marketV2';

export type IStockSimpleChartRange = '1H' | '1D' | '1W' | '1M' | '1Y' | 'All';

export const TOKEN_SIMPLE_CHART_RANGES = [
  '1H',
  '1D',
  '1W',
  '1M',
  '1Y',
  'All',
] as const satisfies readonly IStockSimpleChartRange[];

export const STOCK_SHARE_SIMPLE_CHART_RANGES =
  TOKEN_SIMPLE_CHART_RANGES satisfies readonly IStockSimpleChartRange[];

const STOCK_SIMPLE_CHART_ONE_MONTH_SECONDS = 30 * 24 * 60 * 60;

type IStockSimpleChartRequestParams = {
  coinGeckoId?: string;
  isNative: boolean;
  marketAssetId?: string;
  networkId: string;
  priceMode: 'share' | 'token';
  range: IStockSimpleChartRange;
  stockId?: string;
  tokenAddress: string;
};

export function resolveStockSimpleChartRequestScope({
  coinGeckoId,
  isNative,
  marketAssetId,
  networkId,
  priceMode,
  range,
  stockId,
  tokenAddress,
}: IStockSimpleChartRequestParams): IStockSimpleChartRequestParams {
  if (priceMode === 'share') {
    return {
      coinGeckoId: undefined,
      isNative: false,
      marketAssetId: undefined,
      networkId: '',
      priceMode,
      range,
      stockId,
      tokenAddress: '',
    };
  }

  return {
    coinGeckoId,
    isNative,
    marketAssetId,
    networkId,
    priceMode,
    range,
    stockId: undefined,
    tokenAddress,
  };
}

const STOCK_SIMPLE_CHART_RANGE_SECONDS: Record<
  IStockSimpleChartRange,
  number | undefined
> = {
  '1H': 60 * 60,
  '1D': 24 * 60 * 60,
  '1W': 7 * 24 * 60 * 60,
  '1M': STOCK_SIMPLE_CHART_ONE_MONTH_SECONDS,
  '1Y': 365 * 24 * 60 * 60,
  All: undefined,
};

const STOCK_TOKEN_CHART_INTERVALS: Record<IStockSimpleChartRange, string> = {
  '1H': '1m',
  '1D': '15m',
  '1W': '1H',
  '1M': '4H',
  '1Y': '1D',
  All: '1W',
};

const COINGECKO_CHART_DAYS: Record<IStockSimpleChartRange, string> = {
  '1H': '1',
  '1D': '1',
  '1W': '7',
  '1M': '30',
  '1Y': '365',
  All: 'max',
};

const STOCK_SHARE_CHART_PERIODS: Record<
  IStockSimpleChartRange,
  IMarketStockPublicChartPeriod
> = {
  '1H': '1h',
  '1D': '1d',
  '1W': '1w',
  '1M': '1y',
  '1Y': '1y',
  All: 'all',
};

async function resolveTokenChartCoinGeckoId({
  coinGeckoId,
  networkId,
  tokenAddress,
}: {
  coinGeckoId?: string;
  networkId: string;
  tokenAddress: string;
}) {
  const normalizedCoinGeckoId = coinGeckoId?.trim();
  if (normalizedCoinGeckoId) {
    return normalizedCoinGeckoId;
  }

  try {
    const tokenInfo = await backgroundApiProxy.serviceToken.fetchTokenInfoOnly({
      networkId,
      tokenAddress,
    });
    return tokenInfo?.info?.coingeckoId?.trim() || undefined;
  } catch (_error) {
    return undefined;
  }
}

export async function fetchStockSimpleChartPoints(
  params: IStockSimpleChartRequestParams,
): Promise<IMarketTokenChart> {
  const {
    coinGeckoId,
    isNative,
    marketAssetId,
    networkId,
    priceMode,
    range,
    stockId,
    tokenAddress,
  } = resolveStockSimpleChartRequestScope(params);

  const isSharePrice = priceMode === 'share';
  if (isSharePrice && !stockId) {
    return [];
  }
  if (
    !isSharePrice &&
    !marketAssetId &&
    !coinGeckoId &&
    (!networkId || (!tokenAddress && !isNative))
  ) {
    return [];
  }

  if (isSharePrice) {
    if (!stockId) {
      return [];
    }
    const response =
      await backgroundApiProxy.serviceMarketV2.fetchMarketStockChart({
        stockId,
        period: STOCK_SHARE_CHART_PERIODS[range],
        points: range === '1M' ? 180 : 100,
      });
    const points = response.points
      .map((point) => [Number(point.t), Number(point.c)] as [number, number])
      .filter(
        ([timestamp, price]) =>
          Number.isFinite(timestamp) && Number.isFinite(price),
      )
      .toSorted((a, b) => a[0] - b[0]);

    if (range !== '1M') {
      return points;
    }

    const latestTimestamp = points.at(-1)?.[0];
    if (latestTimestamp === undefined) {
      return points;
    }

    const timeFrom = latestTimestamp - STOCK_SIMPLE_CHART_ONE_MONTH_SECONDS;
    return points.filter(([timestamp]) => timestamp >= timeFrom);
  }

  const rangeSeconds = STOCK_SIMPLE_CHART_RANGE_SECONDS[range];
  const timeTo = Math.floor(Date.now() / 1000);
  const timeFrom = rangeSeconds ? timeTo - rangeSeconds : undefined;

  if (marketAssetId) {
    const response = await fetchMarketAssetKLineData({
      assetId: marketAssetId,
      interval: STOCK_TOKEN_CHART_INTERVALS[range],
      ...(timeFrom !== undefined ? { timeFrom, timeTo } : undefined),
    });
    return response.points
      .map((point) => [Number(point.t), Number(point.c)] as [number, number])
      .filter(([timestamp, price]) => {
        const isValidPoint =
          Number.isFinite(timestamp) && Number.isFinite(price);
        return (
          isValidPoint &&
          (!timeFrom || timestamp >= timeFrom) &&
          timestamp <= timeTo
        );
      })
      .toSorted((a, b) => a[0] - b[0]);
  }

  if (coinGeckoId || range === 'All') {
    const resolvedCoinGeckoId =
      range === 'All'
        ? await resolveTokenChartCoinGeckoId({
            coinGeckoId,
            networkId,
            tokenAddress,
          })
        : coinGeckoId;
    const response = await backgroundApiProxy.serviceMarket.fetchTokenChart(
      resolvedCoinGeckoId,
      COINGECKO_CHART_DAYS[range],
      {
        requestCurrency: 'usd',
        ...(!resolvedCoinGeckoId ? { networkId, tokenAddress } : undefined),
      },
    );
    return response
      .map(
        ([timestamp, price]) =>
          [
            timestamp > 10_000_000_000
              ? Math.floor(timestamp / 1000)
              : timestamp,
            Number(price),
          ] as [number, number],
      )
      .filter(
        ([timestamp, price]) =>
          Number.isFinite(timestamp) &&
          Number.isFinite(price) &&
          (!timeFrom || timestamp >= timeFrom) &&
          timestamp <= timeTo,
      )
      .toSorted((a, b) => a[0] - b[0]);
  }

  if (timeFrom === undefined) {
    return [];
  }

  const response =
    await backgroundApiProxy.serviceMarketV2.fetchMarketTokenKline({
      interval: STOCK_TOKEN_CHART_INTERVALS[range],
      networkId,
      tokenAddress,
      timeFrom,
      timeTo,
      autoHandleError: false,
    });

  return response.points
    .map((point) => [Number(point.t), Number(point.c)] as [number, number])
    .filter(([timestamp, price]) => {
      const isValidPoint = Number.isFinite(timestamp) && Number.isFinite(price);
      return isValidPoint;
    })
    .toSorted((a, b) => a[0] - b[0]);
}
