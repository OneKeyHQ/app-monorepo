import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { fetchMarketAssetKLineData } from '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketAssetKLineData';
import {
  fillMarketKLineGaps,
  getMarketApiKLineIntervalSeconds,
} from '@onekeyhq/shared/src/utils/marketKLineUtils';
import { getUSMarketTradingHours } from '@onekeyhq/shared/src/utils/tradingHoursUtils';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';
import type { IMarketStockPublicChartPeriod } from '@onekeyhq/shared/types/marketV2';

import { getMarketStockPreviousClose } from '../../utils/marketStockPreviousClose';

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

// The previous session close frames the within-day ranges. On longer ranges
// it is one of the many closes already on the line, so it stays off.
const STOCK_SIMPLE_CHART_PREVIOUS_CLOSE_RANGES =
  new Set<IStockSimpleChartRange>(['1H', '1D']);

export function resolveStockSimpleChartPreviousClose({
  priceMode,
  range,
  stockDetail,
}: {
  priceMode: 'share' | 'token';
  range: IStockSimpleChartRange;
  stockDetail: Parameters<typeof getMarketStockPreviousClose>[0];
}): number | undefined {
  // Only the share quote reports the figure; a tokenized share trades on its
  // own price and has no session close to compare against.
  if (
    priceMode !== 'share' ||
    !STOCK_SIMPLE_CHART_PREVIOUS_CLOSE_RANGES.has(range)
  ) {
    return undefined;
  }
  return getMarketStockPreviousClose(stockDetail);
}

// The line ends on a live pulse while the asset is trading. Crypto trades
// around the clock, so it always pulses; a stock only pulses while its market
// is open.
export function resolveStockSimpleChartPulseLastPoint({
  stockDetail,
  stockId,
  tokenStock,
}: {
  stockDetail?: { marketStatus?: { isOpen?: boolean } } | null;
  stockId?: string;
  tokenStock?: { isOpen?: boolean } | null;
}): boolean {
  const isStock = Boolean(stockId) || Boolean(tokenStock);
  if (!isStock) {
    return true;
  }
  return (
    stockDetail?.marketStatus?.isOpen === true || tokenStock?.isOpen === true
  );
}

/**
 * One interval for every range, on purpose. `usePromiseResult` treats a changed
 * `pollingInterval` as a timer retune: it withholds the dependency-triggered run
 * for the full new duration, so a range switch would sit on the previous
 * range's line for minutes. Per-range pacing is applied inside the request
 * instead, via `resolveStockSimpleChartMinRefreshMs`.
 */
export const STOCK_SIMPLE_CHART_POLLING_MS = 30_000;

// The line only gains a point when a bucket closes, so each range reloads at
// roughly its own bucket rate: reloading a year of daily buckets every 30s would
// redraw the same line. The quote pinned to the tail is kept live separately, so
// these floors only pace how the drawn history catches up.
const STOCK_SIMPLE_CHART_MIN_REFRESH_MS: Record<
  IStockSimpleChartRange,
  number
> = {
  '1H': 30_000,
  '1D': 60_000,
  '1W': 300_000,
  '1M': 300_000,
  '1Y': 600_000,
  All: 600_000,
};

/**
 * Whether a finished request may publish its series as the fallback that the
 * paced polls and the failure path read back. Refreshes of one scope can overlap
 * and answer out of order, so an older response must not restore an older line
 * over a newer one; a response whose scope the user has already left must not
 * write at all.
 */
export function shouldStoreStockSimpleChartSeries({
  currentScopeKey,
  requestScopeKey,
  requestSeq,
  storedSeq,
}: {
  currentScopeKey: string;
  requestScopeKey: string;
  requestSeq: number;
  storedSeq: number | undefined;
}): boolean {
  return currentScopeKey === requestScopeKey && requestSeq > (storedSeq ?? 0);
}

export function resolveStockSimpleChartMinRefreshMs({
  range,
}: {
  range: IStockSimpleChartRange;
}): number {
  return STOCK_SIMPLE_CHART_MIN_REFRESH_MS[range];
}

/**
 * Identifies which asset and window a fetched series belongs to, so a refresh
 * that fails can be told apart from one whose scope changed underneath it.
 */
export function buildStockSimpleChartScopeKey({
  coinGeckoId,
  marketAssetId,
  networkId,
  priceMode,
  range,
  stockId,
  tokenAddress,
}: {
  coinGeckoId?: string;
  marketAssetId?: string;
  networkId: string;
  priceMode: 'share' | 'token';
  range: IStockSimpleChartRange;
  stockId?: string;
  tokenAddress: string;
}): string {
  return [
    priceMode,
    range,
    networkId,
    tokenAddress,
    stockId ?? '',
    marketAssetId ?? '',
    coinGeckoId ?? '',
  ].join('|');
}

export function resolveStockSimpleChartLivePrice({
  priceMode,
  stockDetail,
  tokenDetail,
}: {
  priceMode: 'share' | 'token';
  stockDetail?: { price?: string } | null;
  tokenDetail?: { price?: string } | null;
}): string | undefined {
  const rawPrice =
    priceMode === 'share' ? stockDetail?.price : tokenDetail?.price;
  return rawPrice?.trim() || undefined;
}

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

// The token K-line endpoint honours whatever interval it is given (unlike the
// Asset one below), but only returns buckets that actually traded, so the
// series is sparse wherever the market is thin.
const STOCK_TOKEN_CHART_INTERVALS: Record<IStockSimpleChartRange, string> = {
  '1H': '1m',
  '1D': '5m',
  '1W': '1H',
  '1M': '4H',
  '1Y': '1D',
  All: '1W',
};

// The Asset K-line endpoint derives its own granularity from the requested
// window and only honours `interval` below a full day: measured against
// `/utility/v1/market/asset/kline`, a 23h55m window answers `5m` with 300s
// spacing, while a 86400s window returns 24 hourly points whatever `interval`
// says. It also never serves finer than 300s, so `1m` was only ever an
// unfulfilled request. Both entries below say what the endpoint actually
// serves; drop this map and the clamp once it honours `interval` at a full day.
const MARKET_ASSET_CHART_INTERVALS: Record<IStockSimpleChartRange, string> = {
  ...STOCK_TOKEN_CHART_INTERVALS,
  '1H': '5m',
  '1D': '5m',
};

export function resolveStockSimpleChartBucketSeconds({
  coinGeckoId,
  marketAssetId,
  priceMode,
  range,
}: {
  coinGeckoId?: string;
  marketAssetId?: string;
  priceMode: 'share' | 'token';
  range: IStockSimpleChartRange;
}): number | undefined {
  if (priceMode === 'share') {
    return undefined;
  }
  if (marketAssetId) {
    return getMarketApiKLineIntervalSeconds(
      MARKET_ASSET_CHART_INTERVALS[range],
    );
  }
  if (coinGeckoId || range === 'All') {
    return undefined;
  }
  return getMarketApiKLineIntervalSeconds(STOCK_TOKEN_CHART_INTERVALS[range]);
}

function shouldDropLiveMergeTailPoint({
  intervalSeconds,
  nowSeconds,
  timestamp,
}: {
  intervalSeconds?: number;
  nowSeconds: number;
  timestamp: number;
}): boolean {
  if (timestamp > nowSeconds) {
    return true;
  }
  return Boolean(
    intervalSeconds &&
    intervalSeconds > 0 &&
    timestamp + intervalSeconds > nowSeconds,
  );
}

const STOCK_SIMPLE_CHART_SESSION_CLIP_RANGES = new Set<IStockSimpleChartRange>([
  '1H',
  '1D',
]);

/**
 * Start of the visible 1H/1D window while a share session is in progress.
 *
 * The 1H/1D feeds keep last Friday's prints over the weekend so a closed
 * market still has a line. Once Monday pre-market opens, those prints are
 * still in the payload — the time axis then stretches Friday→now into one
 * long horizontal segment. Token series already arrive windowed; this clip
 * is share-only. Clock math cannot see holidays, so an explicit `isOpen
 * === false` keeps last session. Weekday session gaps still clip so the
 * Monday 09:30 opening cross does not restore Friday.
 */
export function resolveStockSimpleChartActiveRangeStartSeconds({
  isOpen,
  nowSeconds,
  priceMode,
  range,
}: {
  isOpen?: boolean;
  nowSeconds: number;
  priceMode: 'share' | 'token';
  range: IStockSimpleChartRange;
}): number | undefined {
  if (
    priceMode !== 'share' ||
    !STOCK_SIMPLE_CHART_SESSION_CLIP_RANGES.has(range) ||
    !Number.isFinite(nowSeconds)
  ) {
    return undefined;
  }
  const rangeSeconds = STOCK_SIMPLE_CHART_RANGE_SECONDS[range];
  if (!rangeSeconds) {
    return undefined;
  }
  const nowMs = nowSeconds * 1000;
  const hours = getUSMarketTradingHours(new Date(nowMs));
  if (nowMs >= hours.weekendStartInstant && nowMs < hours.weekendEndInstant) {
    return undefined;
  }
  if (isOpen === false && !hours.isNowInSessionGap) {
    return undefined;
  }
  return nowSeconds - rangeSeconds;
}

export function resolveStockSimpleChartClipKey({
  isOpen,
  nowSeconds,
  priceMode,
  range,
}: {
  isOpen?: boolean;
  nowSeconds: number;
  priceMode: 'share' | 'token';
  range: IStockSimpleChartRange;
}): 'clip' | 'keep' {
  return resolveStockSimpleChartActiveRangeStartSeconds({
    isOpen,
    nowSeconds,
    priceMode,
    range,
  }) === undefined
    ? 'keep'
    : 'clip';
}

export function clipStockSimpleChartToActiveRange({
  isOpen,
  nowSeconds,
  points,
  priceMode,
  range,
}: {
  isOpen?: boolean;
  nowSeconds: number;
  points: IMarketTokenChart;
  priceMode: 'share' | 'token';
  range: IStockSimpleChartRange;
}): IMarketTokenChart {
  const clipStart = resolveStockSimpleChartActiveRangeStartSeconds({
    isOpen,
    nowSeconds,
    priceMode,
    range,
  });
  if (clipStart === undefined) {
    return points;
  }
  return points.filter(([timestamp]) => timestamp >= clipStart);
}

/**
 * Pins the line's last displayed price to the title quote without rewriting a
 * closed bucket's cutoff. K-line `t` is the bucket start, so a still-open (or
 * clock-ahead) bucket is dropped and replaced by a single `[now, livePrice]`
 * point. The live tail is always appended so the last label matches the title,
 * including pre-market / stale 1H windows.
 */
export function mergeStockSimpleChartLivePrice({
  intervalSeconds,
  livePrice,
  nowSeconds,
  points,
}: {
  intervalSeconds?: number;
  livePrice?: string | number;
  nowSeconds: number;
  points: IMarketTokenChart;
}): IMarketTokenChart {
  const price = Number(livePrice);
  if (
    points.length === 0 ||
    !Number.isFinite(price) ||
    price <= 0 ||
    !Number.isFinite(nowSeconds)
  ) {
    return points;
  }

  let keptLength = points.length;
  while (
    keptLength > 0 &&
    shouldDropLiveMergeTailPoint({
      intervalSeconds,
      nowSeconds,
      timestamp: points[keptLength - 1][0],
    })
  ) {
    keptLength -= 1;
  }
  if (keptLength === 0) {
    return [[nowSeconds, price]];
  }
  const historical =
    keptLength === points.length ? points : points.slice(0, keptLength);

  const lastClosedTimestamp = historical[historical.length - 1][0];
  if (nowSeconds === lastClosedTimestamp) {
    return [...historical.slice(0, -1), [nowSeconds, price]];
  }

  return [...historical, [nowSeconds, price]];
}

/**
 * Display series for the simple chart: drop last-session prints that would
 * stretch the time axis across a weekend/overnight close, then pin the live
 * quote. If clipping removed every point, keep a single `[now, live]` so the
 * title and the line still agree. Without a usable live quote, keep the
 * unclipped history so the chart is not mounted empty.
 */
export function resolveStockSimpleChartDisplayPoints({
  intervalSeconds,
  isOpen,
  livePrice,
  nowSeconds,
  points,
  priceMode,
  range,
}: {
  intervalSeconds?: number;
  isOpen?: boolean;
  livePrice?: string | number;
  nowSeconds: number;
  points: IMarketTokenChart;
  priceMode: 'share' | 'token';
  range: IStockSimpleChartRange;
}): IMarketTokenChart {
  const clipped = clipStockSimpleChartToActiveRange({
    isOpen,
    nowSeconds,
    points,
    priceMode,
    range,
  });
  if (clipped.length === 0 && points.length > 0) {
    const price = Number(livePrice);
    if (Number.isFinite(price) && price > 0 && Number.isFinite(nowSeconds)) {
      return [[nowSeconds, price]];
    }
    return points;
  }
  return mergeStockSimpleChartLivePrice({
    intervalSeconds,
    livePrice,
    nowSeconds,
    points: clipped,
  });
}

// Five minutes short of a day, to stay on the 5m series. The chart loses its
// oldest bucket, which reads the same at this scale as a full day.
const MARKET_ASSET_SUB_DAY_WINDOW_SECONDS = 24 * 60 * 60 - 5 * 60;

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
  '1M': '1m',
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
      });
    const points = response.points
      .map((point) => [Number(point.t), Number(point.c)] as [number, number])
      .filter(
        ([timestamp, price]) =>
          Number.isFinite(timestamp) && Number.isFinite(price),
      )
      .toSorted((a, b) => a[0] - b[0]);

    return points;
  }

  const rangeSeconds = STOCK_SIMPLE_CHART_RANGE_SECONDS[range];
  const timeTo = Math.floor(Date.now() / 1000);
  const timeFrom = rangeSeconds ? timeTo - rangeSeconds : undefined;

  if (marketAssetId) {
    const assetTimeFrom =
      range === '1D' && timeFrom !== undefined
        ? timeTo - MARKET_ASSET_SUB_DAY_WINDOW_SECONDS
        : timeFrom;
    const response = await fetchMarketAssetKLineData({
      assetId: marketAssetId,
      interval: MARKET_ASSET_CHART_INTERVALS[range],
      ...(assetTimeFrom !== undefined
        ? { timeFrom: assetTimeFrom, timeTo }
        : undefined),
    });
    return response.points
      .map((point) => [Number(point.t), Number(point.c)] as [number, number])
      .filter(([timestamp, price]) => {
        const isValidPoint =
          Number.isFinite(timestamp) && Number.isFinite(price);
        return (
          isValidPoint &&
          (!assetTimeFrom || timestamp >= assetTimeFrom) &&
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

  const tokenInterval = STOCK_TOKEN_CHART_INTERVALS[range];
  const response =
    await backgroundApiProxy.serviceMarketV2.fetchMarketTokenKline({
      interval: tokenInterval,
      networkId,
      tokenAddress,
      timeFrom,
      timeTo,
      autoHandleError: false,
    });

  const points = response.points
    .map((point) => [Number(point.t), Number(point.c)] as [number, number])
    .filter(([timestamp, price]) => {
      const isValidPoint = Number.isFinite(timestamp) && Number.isFinite(price);
      return isValidPoint;
    })
    .toSorted((a, b) => a[0] - b[0]);

  // This feed skips buckets that never traded, and the chart spaces points
  // evenly whatever their timestamps say — so an untouched sparse series draws
  // a thin market's quiet hours as if they were single steps, squashing the
  // shape and pulling the time axis out of true.
  return fillMarketKLineGaps(
    points,
    getMarketApiKLineIntervalSeconds(tokenInterval),
  );
}
