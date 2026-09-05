import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IMarketKLineProvider,
  IMarketTokenKLineDataPoint,
  IMarketTokenKLineHistoryMeta,
  IMarketTokenKLineResponse,
} from '@onekeyhq/shared/types/marketV2';

import { sliceRequest } from '../sliceRequest';

const FIRST_SCREEN_KLINE_PREFETCH_MIN_BAR_COUNT = 200;
const FIRST_SCREEN_KLINE_ESTIMATED_BAR_WIDTH_PX = 5;
const FIRST_SCREEN_KLINE_PREFETCH_BUFFER_BAR_COUNT = 128;
const NATIVE_FIRST_SCREEN_KLINE_PREFETCH_BAR_COUNT = 200;
// Align first-screen requests with the backend single-page OKX cap so the
// initial chart package can complete in one utility round-trip when dense.
const FIRST_SCREEN_KLINE_SINGLE_PAGE_MAX_BAR_COUNT = 299;
const FIRST_SCREEN_KLINE_PREFETCH_FUTURE_SECONDS = 5 * 60;
const MAX_FIRST_SCREEN_KLINE_PREFETCH_FUTURE_SECONDS = 24 * 60 * 60;
const MAX_FIRST_SCREEN_KLINE_PREFETCH_HISTORY_SECONDS = 5 * 365 * 24 * 60 * 60;
const FIRST_SCREEN_KLINE_PREFETCH_CACHE_TTL_MS = 30 * 1000;
const MAX_FIRST_SCREEN_KLINE_PREFETCH_CACHE_ENTRIES = 12;
const MAX_TRADING_VIEW_KLINE_TARGET_COUNT = 2000;
const MIN_KLINE_TIME_SPAN_SECONDS = 2 * 24 * 60 * 60;

export type ITradingViewV2KLineDataFallback = (params: {
  tokenAddress: string;
  networkId: string;
  interval: string;
  timeFrom: number;
  timeTo: number;
}) => Promise<IMarketTokenKLineResponse | null | undefined>;

export interface ITradingViewV2FirstScreenPrefetchResult {
  interval: string;
  requestedTimeFrom: number;
  requestedTimeTo: number;
  coveredTimeFrom: number;
  coveredTimeTo: number;
  points: IMarketTokenKLineDataPoint[];
  historyMeta?: IMarketTokenKLineHistoryMeta;
  historyExhausted: boolean;
}

export interface ITradingViewV2FirstScreenPrefetchParams {
  tokenAddress: string;
  networkId: string;
  kLineProvider?: IMarketKLineProvider;
  kLineProviderSymbol?: string;
  interval?: string;
  preferredHistorySeconds?: number;
  preferredFutureSeconds?: number;
  preferredCountBack?: number;
  historyStartTime?: number;
}

interface ITradingViewV2FirstScreenPrefetchRecord {
  promise: Promise<ITradingViewV2FirstScreenPrefetchResult | undefined>;
  latestResult?: ITradingViewV2FirstScreenPrefetchResult;
  backgroundRequestId: string;
  isInitialPending: boolean;
  expiresAt: number;
}

interface ITradingViewV2FirstScreenPrefetchSubscriberParams extends Pick<
  ITradingViewV2FirstScreenPrefetchParams,
  | 'tokenAddress'
  | 'networkId'
  | 'kLineProvider'
  | 'kLineProviderSymbol'
  | 'historyStartTime'
> {
  interval: string;
  onResult: (
    result: ITradingViewV2FirstScreenPrefetchResult | undefined,
  ) => void;
  onError?: (error: unknown) => void;
}

type ITradingViewV2FirstScreenPrefetchRecordSubscriber = (
  record: ITradingViewV2FirstScreenPrefetchRecord,
) => void;

interface IFetchKLineDataFallbackParams {
  tokenAddress: string;
  networkId: string;
  interval: string;
  timeFrom: number;
  timeTo: number;
  kLineDataFallback?: ITradingViewV2KLineDataFallback;
}

interface ITradingViewV2Params {
  requestId?: string;
  tokenAddress: string;
  networkId: string;
  kLineProvider?: IMarketKLineProvider;
  kLineProviderSymbol?: string;
  interval: string;
  timeFrom: number;
  timeTo: number;
  targetCount?: number;
  stopAfterCount?: number;
  historyStartTime?: number;
  autoHandleError?: boolean;
  requestExactRange?: boolean;
  reuseLatestPage?: boolean;
  kLineDataFallback?: ITradingViewV2KLineDataFallback;
  primaryKLineDataUnavailable?: boolean;
  onPrimaryKLineDataUnavailable?: () => void;
}

interface IKLineRequestEntry {
  key: string;
  backgroundRequestId?: string;
  coveredFrom: number;
  coveredTo: number;
  barFrom?: number;
  barTo?: number;
  targetCount?: number;
  historyStartTime?: number;
  promise: Promise<IMarketTokenKLineResponse | null>;
  upgradePromise?: Promise<IMarketTokenKLineResponse | null>;
  upgradeTargetCount?: number;
  retainCompletedResult: boolean;
  expiresAt?: number;
}

const kLineRequestEntries: IKLineRequestEntry[] = [];
const firstScreenPrefetchRecords = new Map<
  string,
  ITradingViewV2FirstScreenPrefetchRecord
>();
const firstScreenPrefetchRecordSubscribers = new Map<
  string,
  Set<ITradingViewV2FirstScreenPrefetchRecordSubscriber>
>();
let firstScreenPrefetchRequestSequence = 0;

function createFirstScreenPrefetchRequestId() {
  firstScreenPrefetchRequestSequence += 1;
  return `market_kline_prefetch_${Date.now()}_${firstScreenPrefetchRequestSequence}`;
}

function normalizeKLinePoints({
  points,
  timeFrom,
  timeTo,
}: {
  points: IMarketTokenKLineDataPoint[];
  timeFrom: number;
  timeTo: number;
}): IMarketTokenKLineDataPoint[] {
  const pointsByTimestamp = new Map<number, IMarketTokenKLineDataPoint>();

  for (const point of points) {
    if (point.t >= timeFrom && point.t < timeTo) {
      pointsByTimestamp.set(point.t, point);
    }
  }

  return Array.from(pointsByTimestamp.values()).toSorted((a, b) => a.t - b.t);
}

function hasKLinePoints(data?: IMarketTokenKLineResponse | null) {
  return Boolean(data?.points?.length);
}

function hasValidKLineResponse(
  data?: IMarketTokenKLineResponse | null,
): data is IMarketTokenKLineResponse {
  return Array.isArray(data?.points);
}

function normalizeKLineTargetCount(targetCount: number | undefined) {
  if (
    targetCount === undefined ||
    !Number.isFinite(targetCount) ||
    targetCount <= 0
  ) {
    return undefined;
  }
  return Math.min(
    MAX_TRADING_VIEW_KLINE_TARGET_COUNT,
    Math.max(1, Math.floor(targetCount)),
  );
}

function getFirstScreenKLinePrefetchTargetCount() {
  const viewportWidth =
    typeof globalThis.window === 'undefined' ||
    !Number.isFinite(globalThis.window.innerWidth)
      ? 0
      : globalThis.window.innerWidth;
  const visibleBarEstimate =
    Math.ceil(viewportWidth / FIRST_SCREEN_KLINE_ESTIMATED_BAR_WIDTH_PX) +
    FIRST_SCREEN_KLINE_PREFETCH_BUFFER_BAR_COUNT;
  return Math.min(
    FIRST_SCREEN_KLINE_SINGLE_PAGE_MAX_BAR_COUNT,
    MAX_TRADING_VIEW_KLINE_TARGET_COUNT,
    Math.max(FIRST_SCREEN_KLINE_PREFETCH_MIN_BAR_COUNT, visibleBarEstimate),
  );
}

function normalizeKLineRequestInterval(interval: string) {
  switch (interval.trim()) {
    case '1':
      return '1m';
    case '3':
      return '3m';
    case '5':
      return '5m';
    case '15':
      return '15m';
    case '30':
      return '30m';
    case '60':
      return '1H';
    case '120':
      return '2H';
    case '240':
      return '4H';
    case '480':
      return '8H';
    case '720':
      return '12H';
    case '1h':
      return '1H';
    case '2h':
      return '2H';
    case '4h':
      return '4H';
    case '8h':
      return '8H';
    case '12h':
      return '12H';
    case '1d':
      return '1D';
    case '3d':
      return '3D';
    case '1w':
      return '1W';
    default:
      return interval.trim();
  }
}

function normalizeKLineHistoryStartTime(historyStartTime: number | undefined) {
  return Number.isFinite(historyStartTime) && (historyStartTime ?? 0) >= 0
    ? Math.floor(historyStartTime ?? 0)
    : undefined;
}

function getKLineIntervalSeconds(interval: string) {
  const match =
    normalizeKLineRequestInterval(interval).match(/^(\d+)([mHDWMy])$/);
  if (!match) {
    return undefined;
  }

  const [, count, unit] = match;
  const value = Number(count);
  const secondsByUnit = {
    m: 60,
    H: 60 * 60,
    D: 24 * 60 * 60,
    W: 7 * 24 * 60 * 60,
    M: 30 * 24 * 60 * 60,
    y: 365 * 24 * 60 * 60,
  } as const;
  return value * secondsByUnit[unit as keyof typeof secondsByUnit];
}

function getFirstScreenKLinePrefetchRange({
  nowSeconds,
  interval,
  isNativeToken,
  preferredHistorySeconds,
  preferredFutureSeconds,
  targetCount,
}: {
  nowSeconds: number;
  interval: string;
  isNativeToken: boolean;
  preferredHistorySeconds?: number;
  preferredFutureSeconds?: number;
  targetCount: number;
}) {
  const intervalSeconds = getKLineIntervalSeconds(interval) ?? 60;

  if (isNativeToken) {
    // Native-token requests are limited to 200 bars. Keep the complete
    // prefetch window within that limit, including the future-time buffer.
    const totalSpanSeconds = Math.min(
      MAX_FIRST_SCREEN_KLINE_PREFETCH_HISTORY_SECONDS,
      intervalSeconds * targetCount,
    );
    const futureSeconds = Math.min(
      FIRST_SCREEN_KLINE_PREFETCH_FUTURE_SECONDS,
      Math.max(0, totalSpanSeconds - intervalSeconds),
    );

    return {
      timeFrom: nowSeconds - (totalSpanSeconds - futureSeconds),
      timeTo: nowSeconds + futureSeconds,
    };
  }

  const futureSeconds = Math.min(
    MAX_FIRST_SCREEN_KLINE_PREFETCH_FUTURE_SECONDS,
    Math.max(
      FIRST_SCREEN_KLINE_PREFETCH_FUTURE_SECONDS,
      Number.isFinite(preferredFutureSeconds)
        ? Math.max(0, preferredFutureSeconds ?? 0)
        : 0,
    ),
  );
  const defaultHistorySeconds = intervalSeconds * targetCount;
  const maxHistorySeconds = Math.max(
    0,
    MAX_FIRST_SCREEN_KLINE_PREFETCH_HISTORY_SECONDS - futureSeconds,
  );
  const desiredHistorySeconds =
    Number.isFinite(preferredHistorySeconds) &&
    (preferredHistorySeconds ?? 0) > 0
      ? Math.max(defaultHistorySeconds, preferredHistorySeconds ?? 0)
      : defaultHistorySeconds;
  const historySeconds = Math.min(maxHistorySeconds, desiredHistorySeconds);
  return {
    timeFrom: nowSeconds - historySeconds,
    timeTo: nowSeconds + futureSeconds,
  };
}

function buildKLineRequestKey({
  tokenAddress,
  networkId,
  interval,
  kLineProvider = 'onekey',
  kLineProviderSymbol,
  historyStartTime,
}: Pick<
  ITradingViewV2Params,
  | 'tokenAddress'
  | 'networkId'
  | 'interval'
  | 'kLineProvider'
  | 'kLineProviderSymbol'
  | 'historyStartTime'
>) {
  const normalizedInterval = normalizeKLineRequestInterval(interval);
  const normalizedNetworkId = networkId.trim();
  const normalizedTokenAddress =
    normalizeTokenContractAddress({
      networkId: normalizedNetworkId,
      contractAddress: tokenAddress.trim(),
    }) ?? '';
  const normalizedHistoryStartTime =
    normalizeKLineHistoryStartTime(historyStartTime);

  return [
    kLineProvider,
    kLineProviderSymbol?.trim().toLowerCase() ?? '',
    normalizedNetworkId,
    normalizedTokenAddress,
    normalizedInterval,
    normalizedHistoryStartTime ?? '',
  ].join(':');
}

function pruneExpiredFirstScreenPrefetchRecords(now = Date.now()) {
  for (const [key, record] of firstScreenPrefetchRecords) {
    if (record.expiresAt <= now) {
      if (!record.isInitialPending) {
        firstScreenPrefetchRecords.delete(key);
      }
    }
  }
}

export function subscribeTradingViewV2FirstScreenPrefetch({
  tokenAddress,
  networkId,
  interval,
  kLineProvider,
  kLineProviderSymbol,
  historyStartTime,
  onResult,
  onError,
}: ITradingViewV2FirstScreenPrefetchSubscriberParams) {
  pruneExpiredFirstScreenPrefetchRecords();
  const key = buildKLineRequestKey({
    tokenAddress,
    networkId,
    interval,
    kLineProvider,
    kLineProviderSymbol,
    historyStartTime,
  });
  let isActive = true;
  const handleRecord = (record: ITradingViewV2FirstScreenPrefetchRecord) => {
    const promise = record.latestResult
      ? Promise.resolve(record.latestResult)
      : record.promise;
    void promise.then(
      (result) => {
        if (isActive) {
          onResult(result);
        }
      },
      (error: unknown) => {
        if (isActive) {
          onError?.(error);
        }
      },
    );
  };
  const subscribers =
    firstScreenPrefetchRecordSubscribers.get(key) ??
    new Set<ITradingViewV2FirstScreenPrefetchRecordSubscriber>();
  subscribers.add(handleRecord);
  firstScreenPrefetchRecordSubscribers.set(key, subscribers);
  const existingRecord = firstScreenPrefetchRecords.get(key);
  if (existingRecord) {
    handleRecord(existingRecord);
  }

  return () => {
    isActive = false;
    const currentSubscribers = firstScreenPrefetchRecordSubscribers.get(key);
    currentSubscribers?.delete(handleRecord);
    if (currentSubscribers?.size === 0) {
      firstScreenPrefetchRecordSubscribers.delete(key);
    }
  };
}

function notifyFirstScreenPrefetchRecordSubscribers(
  key: string,
  record: ITradingViewV2FirstScreenPrefetchRecord,
) {
  const subscribers = firstScreenPrefetchRecordSubscribers.get(key);
  if (!subscribers) {
    return;
  }
  for (const subscriber of subscribers) {
    subscriber(record);
  }
}

function cancelFirstScreenPrefetchRecord(
  key: string,
  record: ITradingViewV2FirstScreenPrefetchRecord,
) {
  firstScreenPrefetchRecords.delete(key);
  for (let index = kLineRequestEntries.length - 1; index >= 0; index -= 1) {
    if (
      kLineRequestEntries[index].backgroundRequestId ===
      record.backgroundRequestId
    ) {
      kLineRequestEntries.splice(index, 1);
    }
  }
  void backgroundApiProxy.serviceMarketV2
    .cancelMarketTokenKlineByCount({
      requestId: record.backgroundRequestId,
    })
    .catch((error: unknown) => {
      console.error('Failed to cancel stale prefetched kline data:', error);
    });
}

function cancelStaleFirstScreenPrefetchRecords(activeKey: string) {
  for (const [key, record] of firstScreenPrefetchRecords) {
    if (
      key !== activeKey &&
      !firstScreenPrefetchRecordSubscribers.get(key)?.size &&
      record.isInitialPending
    ) {
      cancelFirstScreenPrefetchRecord(key, record);
    }
  }
}

function removeKLineRequest(entry: IKLineRequestEntry) {
  const index = kLineRequestEntries.indexOf(entry);
  if (index >= 0) {
    kLineRequestEntries.splice(index, 1);
  }
}

function pruneExpiredKLineRequests(now = Date.now()) {
  for (let index = kLineRequestEntries.length - 1; index >= 0; index -= 1) {
    const entry = kLineRequestEntries[index];
    if (
      !entry.upgradePromise &&
      entry.expiresAt !== undefined &&
      entry.expiresAt <= now
    ) {
      kLineRequestEntries.splice(index, 1);
    }
  }
}

function retainCompletedKLineRequest(entry: IKLineRequestEntry) {
  entry.expiresAt = Date.now() + FIRST_SCREEN_KLINE_PREFETCH_CACHE_TTL_MS;
  pruneExpiredKLineRequests();

  const completedEntries = kLineRequestEntries
    .filter((item) => !item.upgradePromise && item.expiresAt !== undefined)
    .toSorted((a, b) => (a.expiresAt ?? 0) - (b.expiresAt ?? 0));
  const overflowCount =
    completedEntries.length - MAX_FIRST_SCREEN_KLINE_PREFETCH_CACHE_ENTRIES;
  for (let index = 0; index < overflowCount; index += 1) {
    removeKLineRequest(completedEntries[index]);
  }
}

function findCoveringKLineRequest({
  key,
  timeFrom,
  timeTo,
}: {
  key: string;
  timeFrom: number;
  timeTo: number;
}) {
  pruneExpiredKLineRequests();
  for (let index = kLineRequestEntries.length - 1; index >= 0; index -= 1) {
    const entry = kLineRequestEntries[index];
    if (
      entry.key === key &&
      entry.coveredFrom <= timeFrom &&
      entry.coveredTo >= timeTo
    ) {
      return entry;
    }
  }
  return undefined;
}

function findLatestKLineRequest({
  key,
  timeTo,
}: {
  key: string;
  timeTo: number;
}) {
  pruneExpiredKLineRequests();
  for (let index = kLineRequestEntries.length - 1; index >= 0; index -= 1) {
    const entry = kLineRequestEntries[index];
    if (entry.key === key && entry.coveredTo >= timeTo) {
      return entry;
    }
  }
  return undefined;
}

function updateKLineRequestEntryFromData(
  entry: IKLineRequestEntry,
  data: IMarketTokenKLineResponse,
) {
  const { coveredFrom, coveredTo } = data.historyMeta ?? {};
  if (Number.isFinite(coveredFrom)) {
    entry.coveredFrom = coveredFrom ?? entry.coveredFrom;
  }
  if (Number.isFinite(coveredTo)) {
    entry.coveredTo = coveredTo ?? entry.coveredTo;
  }

  if (data.points.length === 0) {
    entry.barFrom = undefined;
    entry.barTo = undefined;
    return;
  }

  let barFrom = Number.POSITIVE_INFINITY;
  let barTo = Number.NEGATIVE_INFINITY;
  for (const point of data.points) {
    barFrom = Math.min(barFrom, point.t);
    barTo = Math.max(barTo, point.t);
  }
  entry.barFrom = barFrom;
  entry.barTo = barTo;
}

function clipKLineResponseToRange({
  data,
  timeFrom,
  timeTo,
  targetCount,
  includeEarlierPoints = false,
}: {
  data: IMarketTokenKLineResponse;
  timeFrom: number;
  timeTo: number;
  targetCount?: number;
  includeEarlierPoints?: boolean;
}) {
  const normalizedTargetCount = normalizeKLineTargetCount(targetCount);
  const eligiblePoints = normalizeKLinePoints({
    points: data.points,
    timeFrom: includeEarlierPoints ? 0 : timeFrom,
    timeTo,
  });
  let points = eligiblePoints;
  if (normalizedTargetCount !== undefined) {
    points = points.slice(-normalizedTargetCount);
  }
  const omittedOlderPoints =
    (!includeEarlierPoints &&
      data.points.some((point) => point.t < timeFrom)) ||
    points.length < eligiblePoints.length;
  return {
    ...data,
    points,
    total: points.length,
    ...(data.historyMeta
      ? {
          historyMeta: {
            ...data.historyMeta,
            noData: data.historyMeta.noData && !omittedOlderPoints,
            isPartial:
              !(data.historyMeta.noData && !omittedOlderPoints) &&
              normalizedTargetCount !== undefined &&
              points.length < normalizedTargetCount,
            requestedCount: normalizedTargetCount,
            returnedCount: points.length,
          },
        }
      : {}),
  };
}

function trackKLineRequest({
  key,
  timeFrom,
  timeTo,
  promise,
  retainCompletedResult,
  targetCount,
  historyStartTime,
  backgroundRequestId,
}: {
  key: string;
  timeFrom: number;
  timeTo: number;
  promise: Promise<IMarketTokenKLineResponse | null>;
  retainCompletedResult: boolean;
  targetCount?: number;
  historyStartTime?: number;
  backgroundRequestId?: string;
}) {
  const entry: IKLineRequestEntry = {
    key,
    backgroundRequestId,
    coveredFrom: timeFrom,
    coveredTo: timeTo,
    targetCount: normalizeKLineTargetCount(targetCount),
    historyStartTime,
    promise,
    retainCompletedResult,
  };
  entry.promise = promise.then(
    (data) => {
      if (data) {
        updateKLineRequestEntryFromData(entry, data);
      }

      if (
        entry.retainCompletedResult &&
        data?.historyMeta?.cancelled !== true &&
        (hasKLinePoints(data) || data?.historyMeta?.noData === true)
      ) {
        retainCompletedKLineRequest(entry);
      } else {
        removeKLineRequest(entry);
      }
      return data;
    },
    (error: unknown) => {
      removeKLineRequest(entry);
      throw error;
    },
  );
  kLineRequestEntries.push(entry);
  return entry;
}

async function fetchKLineDataFallback({
  tokenAddress,
  networkId,
  interval,
  timeFrom,
  timeTo,
  kLineDataFallback,
}: IFetchKLineDataFallbackParams): Promise<IMarketTokenKLineResponse | null> {
  if (!kLineDataFallback) {
    return null;
  }

  try {
    return (
      (await kLineDataFallback({
        tokenAddress,
        networkId,
        interval,
        timeFrom,
        timeTo,
      })) ?? null
    );
  } catch (error) {
    console.error('Failed to fetch fallback kline data:', error);
    return null;
  }
}

async function fetchFallbackIfNeeded({
  data,
  tokenAddress,
  networkId,
  interval,
  timeFrom,
  timeTo,
  kLineDataFallback,
  onPrimaryKLineDataUnavailable,
}: IFetchKLineDataFallbackParams & {
  data?: IMarketTokenKLineResponse | null;
  onPrimaryKLineDataUnavailable?: () => void;
}): Promise<IMarketTokenKLineResponse | null> {
  if (hasKLinePoints(data)) {
    return data ?? null;
  }

  const fallbackData = await fetchKLineDataFallback({
    tokenAddress,
    networkId,
    interval,
    timeFrom,
    timeTo,
    kLineDataFallback,
  });
  if (!hasValidKLineResponse(data) && hasKLinePoints(fallbackData)) {
    onPrimaryKLineDataUnavailable?.();
  }
  return fallbackData ?? (hasValidKLineResponse(data) ? data : null);
}

async function fetchFallbackOnError({
  tokenAddress,
  networkId,
  interval,
  timeFrom,
  timeTo,
  kLineDataFallback,
}: IFetchKLineDataFallbackParams): Promise<IMarketTokenKLineResponse | null> {
  return fetchKLineDataFallback({
    tokenAddress,
    networkId,
    interval,
    timeFrom,
    timeTo,
    kLineDataFallback,
  });
}

export async function fetchTradingViewV2Data({
  requestId,
  tokenAddress,
  networkId,
  kLineProvider = 'onekey',
  kLineProviderSymbol,
  interval,
  timeFrom,
  timeTo,
  targetCount,
  stopAfterCount,
  historyStartTime,
  autoHandleError,
  kLineDataFallback,
  primaryKLineDataUnavailable,
  onPrimaryKLineDataUnavailable,
}: ITradingViewV2Params): Promise<IMarketTokenKLineResponse | null> {
  if (primaryKLineDataUnavailable) {
    return fetchKLineDataFallback({
      tokenAddress,
      networkId,
      interval,
      timeFrom,
      timeTo,
      kLineDataFallback,
    });
  }

  try {
    const normalizedTargetCount = normalizeKLineTargetCount(targetCount);
    const requestParams = {
      tokenAddress,
      networkId,
      provider: kLineProvider,
      providerSymbol: kLineProviderSymbol,
      interval,
      timeFrom,
      timeTo,
      autoHandleError,
    };
    const data = normalizedTargetCount
      ? await backgroundApiProxy.serviceMarketV2.fetchMarketTokenKlineByCount({
          ...requestParams,
          requestId,
          targetCount: normalizedTargetCount,
          stopAfterCount,
          historyStartTime,
        })
      : await backgroundApiProxy.serviceMarketV2.fetchMarketTokenKline(
          requestParams,
        );

    return await fetchFallbackIfNeeded({
      data,
      tokenAddress,
      networkId,
      interval,
      timeFrom,
      timeTo,
      kLineDataFallback,
      onPrimaryKLineDataUnavailable,
    });
  } catch (error) {
    console.error('Failed to fetch kline data:', error);
    return fetchFallbackOnError({
      tokenAddress,
      networkId,
      interval,
      timeFrom,
      timeTo,
      kLineDataFallback,
    });
  }
}

async function fetchTradingViewV2DataWithSlicingUncached({
  requestId,
  tokenAddress,
  networkId,
  kLineProvider = 'onekey',
  kLineProviderSymbol,
  interval,
  timeFrom,
  timeTo,
  targetCount,
  stopAfterCount,
  historyStartTime,
  autoHandleError,
  requestExactRange,
  kLineDataFallback,
  primaryKLineDataUnavailable,
  onPrimaryKLineDataUnavailable,
}: ITradingViewV2Params): Promise<IMarketTokenKLineResponse | null> {
  if (primaryKLineDataUnavailable) {
    return fetchKLineDataFallback({
      tokenAddress,
      networkId,
      interval,
      timeFrom,
      timeTo,
      kLineDataFallback,
    });
  }

  if (normalizeKLineTargetCount(targetCount) !== undefined) {
    return fetchTradingViewV2Data({
      requestId,
      tokenAddress,
      networkId,
      kLineProvider,
      kLineProviderSymbol,
      interval,
      timeFrom,
      timeTo,
      targetCount,
      stopAfterCount,
      historyStartTime,
      autoHandleError,
      kLineDataFallback,
      onPrimaryKLineDataUnavailable,
    });
  }

  try {
    // Check if the token is a native token
    // Native tokens typically have empty or undefined tokenAddress
    const isNativeToken =
      kLineProvider === 'onekey' && (!tokenAddress || tokenAddress === '');

    const requestRanges = requestExactRange
      ? [{ from: timeFrom, to: timeTo, interval }]
      : sliceRequest(interval, timeFrom, timeTo, {
          isNativeToken,
          minTimeSpanSeconds: isNativeToken
            ? undefined
            : MIN_KLINE_TIME_SPAN_SECONDS,
        });

    const dataPromises = requestRanges.map((requestRange) =>
      backgroundApiProxy.serviceMarketV2.fetchMarketTokenKline({
        tokenAddress,
        networkId,
        ...(kLineProvider === 'hyperliquid'
          ? {
              provider: kLineProvider,
              providerSymbol: kLineProviderSymbol,
            }
          : {}),
        interval: requestRange.interval,
        timeFrom: requestRange.from,
        timeTo: requestRange.to,
        autoHandleError,
      }),
    );

    const dataResults = await Promise.all(dataPromises);

    let mergedData: IMarketTokenKLineResponse | null = null;
    const mergedPoints: IMarketTokenKLineDataPoint[] = [];

    for (const data of dataResults) {
      if (hasValidKLineResponse(data)) {
        if (!mergedData) {
          mergedData = { ...data };
        }
        mergedPoints.push(...data.points);
      }
    }

    if (mergedData) {
      const points = normalizeKLinePoints({
        points: mergedPoints,
        timeFrom,
        timeTo,
      });
      mergedData = {
        ...mergedData,
        points,
        total: points.length,
      };
    }

    return await fetchFallbackIfNeeded({
      data: mergedData,
      tokenAddress,
      networkId,
      interval,
      timeFrom,
      timeTo,
      kLineDataFallback,
      onPrimaryKLineDataUnavailable,
    });
  } catch (error) {
    console.error('Failed to fetch kline data:', error);
    return fetchFallbackOnError({
      tokenAddress,
      networkId,
      interval,
      timeFrom,
      timeTo,
      kLineDataFallback,
    });
  }
}

function isKLineResponseSufficient({
  data,
  timeTo,
  targetCount,
}: {
  data: IMarketTokenKLineResponse;
  timeTo: number;
  targetCount: number;
}) {
  if (data.historyMeta?.noData === true) {
    return true;
  }
  let eligiblePointCount = 0;
  for (const point of data.points) {
    if (point.t < timeTo) {
      eligiblePointCount += 1;
    }
  }
  return eligiblePointCount >= targetCount;
}

async function fillKLineResponseToTargetCount({
  data,
  params,
  targetCount,
}: {
  data: IMarketTokenKLineResponse;
  params: ITradingViewV2Params;
  targetCount: number;
}) {
  const cachedData = clipKLineResponseToRange({
    data,
    timeFrom: params.timeFrom,
    timeTo: params.timeTo,
    targetCount,
    includeEarlierPoints: true,
  });
  if (
    cachedData.points.length >= targetCount ||
    cachedData.historyMeta?.noData === true
  ) {
    return cachedData;
  }

  const missingCount = targetCount - cachedData.points.length;
  const intervalSeconds = getKLineIntervalSeconds(params.interval) ?? 60;
  const oldestPointTime = cachedData.points[0]?.t;
  const coveredFrom = data.historyMeta?.coveredFrom;
  let olderRangeEnd = params.timeFrom;
  if (Number.isFinite(coveredFrom)) {
    olderRangeEnd = coveredFrom ?? params.timeFrom;
  } else if (oldestPointTime !== undefined) {
    olderRangeEnd = oldestPointTime;
  }
  const olderTimeTo = Math.min(params.timeTo, olderRangeEnd);
  if (olderTimeTo < 0) {
    return {
      ...cachedData,
      historyMeta: {
        ...cachedData.historyMeta,
        noData: true,
        isPartial: false,
        requestedCount: targetCount,
        returnedCount: cachedData.points.length,
        coveredFrom: 0,
      },
    } satisfies IMarketTokenKLineResponse;
  }

  const olderData = await fetchTradingViewV2DataWithSlicingUncached({
    ...params,
    timeFrom: Math.min(
      params.timeFrom,
      Math.max(0, olderTimeTo - intervalSeconds * missingCount),
    ),
    timeTo: olderTimeTo,
    targetCount: missingCount,
    requestExactRange: true,
  });
  if (!olderData) {
    return cachedData;
  }

  const allPoints = normalizeKLinePoints({
    points: [...olderData.points, ...cachedData.points],
    timeFrom: 0,
    timeTo: params.timeTo,
  });
  const cachedCoveredFrom = cachedData.historyMeta?.coveredFrom;
  const olderCoveredFrom = olderData.historyMeta?.coveredFrom;
  const mergedCoveredFrom = Math.min(
    Number.isFinite(cachedCoveredFrom)
      ? (cachedCoveredFrom ?? params.timeFrom)
      : params.timeFrom,
    Number.isFinite(olderCoveredFrom)
      ? (olderCoveredFrom ?? olderTimeTo)
      : olderTimeTo,
  );
  const cachedCoveredTo = cachedData.historyMeta?.coveredTo;
  const olderCoveredTo = olderData.historyMeta?.coveredTo;
  const mergedCoveredTo = Math.max(
    Number.isFinite(cachedCoveredTo)
      ? (cachedCoveredTo ?? params.timeTo)
      : params.timeTo,
    Number.isFinite(olderCoveredTo)
      ? (olderCoveredTo ?? olderTimeTo)
      : olderTimeTo,
  );
  return {
    ...cachedData,
    points: allPoints,
    total: allPoints.length,
    historyMeta: {
      noData:
        olderData.historyMeta?.cancelled !== true &&
        olderData.historyMeta?.noData === true,
      isPartial:
        olderData.historyMeta?.cancelled === true ||
        (olderData.historyMeta?.noData !== true &&
          allPoints.length < targetCount),
      ...(olderData.historyMeta?.cancelled === true ? { cancelled: true } : {}),
      requestedCount: targetCount,
      returnedCount: allPoints.length,
      coveredFrom: mergedCoveredFrom,
      coveredTo: mergedCoveredTo,
    },
  } satisfies IMarketTokenKLineResponse;
}

function startKLineRequestUpgrade({
  entry,
  params,
  targetCount,
}: {
  entry: IKLineRequestEntry;
  params: ITradingViewV2Params;
  targetCount: number;
}) {
  const basePromise = entry.promise;
  const upgradeTask = (async () => {
    const data = await basePromise;
    if (!data) {
      return null;
    }

    const upgradedData = isKLineResponseSufficient({
      data,
      timeTo: params.timeTo,
      targetCount,
    })
      ? data
      : ((await fillKLineResponseToTargetCount({
          data,
          params: {
            ...params,
            historyStartTime: params.historyStartTime ?? entry.historyStartTime,
          },
          targetCount,
        })) ?? data);

    entry.promise = Promise.resolve(upgradedData);
    updateKLineRequestEntryFromData(entry, upgradedData);
    if (
      entry.retainCompletedResult &&
      upgradedData.historyMeta?.cancelled !== true &&
      (hasKLinePoints(upgradedData) ||
        upgradedData.historyMeta?.noData === true)
    ) {
      retainCompletedKLineRequest(entry);
    }
    return upgradedData;
  })();
  const upgradePromise = upgradeTask.then(
    (data) => {
      entry.upgradePromise = undefined;
      entry.upgradeTargetCount = undefined;
      return data;
    },
    (error: unknown) => {
      entry.upgradePromise = undefined;
      entry.upgradeTargetCount = undefined;
      if (entry.retainCompletedResult) {
        retainCompletedKLineRequest(entry);
      }
      throw error;
    },
  );
  entry.upgradePromise = upgradePromise;
  entry.upgradeTargetCount = targetCount;
  return upgradePromise;
}

async function ensureKLineRequestTargetCount({
  entry,
  params,
  targetCount,
}: {
  entry: IKLineRequestEntry;
  params: ITradingViewV2Params;
  targetCount: number;
}) {
  entry.targetCount = Math.max(entry.targetCount ?? 0, targetCount);
  const activeUpgradeTargetCount = entry.upgradeTargetCount;
  const upgradePromise =
    entry.upgradePromise ??
    startKLineRequestUpgrade({
      entry,
      params,
      targetCount: entry.targetCount,
    });
  const data = await upgradePromise;
  if (
    !data ||
    isKLineResponseSufficient({
      data,
      timeTo: params.timeTo,
      targetCount,
    })
  ) {
    return data;
  }

  if (
    activeUpgradeTargetCount !== undefined &&
    activeUpgradeTargetCount < targetCount
  ) {
    return ensureKLineRequestTargetCount({ entry, params, targetCount });
  }
  return data;
}

async function fetchTradingViewV2DataWithRequestReuse(
  params: ITradingViewV2Params,
  {
    retryAfterSharedFailure,
    retainCompletedResult,
  }: {
    retryAfterSharedFailure: boolean;
    retainCompletedResult: boolean;
  },
): Promise<IMarketTokenKLineResponse | null> {
  const key = buildKLineRequestKey(params);
  const requestedTargetCount = normalizeKLineTargetCount(params.targetCount);
  const sharedRequest =
    findCoveringKLineRequest({
      key,
      timeFrom: params.timeFrom,
      timeTo: params.timeTo,
    }) ??
    (params.reuseLatestPage
      ? findLatestKLineRequest({ key, timeTo: params.timeTo })
      : undefined);
  if (sharedRequest) {
    if (retainCompletedResult) {
      sharedRequest.retainCompletedResult = true;
    }
    if (params.requestId) {
      sharedRequest.backgroundRequestId = params.requestId;
    }
    let sharedData: IMarketTokenKLineResponse | null = null;
    try {
      sharedData =
        requestedTargetCount !== undefined
          ? await ensureKLineRequestTargetCount({
              entry: sharedRequest,
              params,
              targetCount: requestedTargetCount,
            })
          : await sharedRequest.promise;
    } catch (error) {
      removeKLineRequest(sharedRequest);
      if (!retryAfterSharedFailure) {
        throw error;
      }
    }
    const sharedRequestCoversRange =
      sharedRequest.coveredFrom <= params.timeFrom &&
      sharedRequest.coveredTo >= params.timeTo;
    const canReuseLatestPage =
      params.reuseLatestPage && sharedRequest.coveredTo >= params.timeTo;
    const sharedDataIsSufficient =
      requestedTargetCount === undefined ||
      (sharedData !== null &&
        isKLineResponseSufficient({
          data: sharedData,
          timeTo: params.timeTo,
          targetCount: requestedTargetCount,
        }));
    if (
      sharedData &&
      sharedDataIsSufficient &&
      (sharedRequestCoversRange || canReuseLatestPage)
    ) {
      if (requestedTargetCount !== undefined) {
        return clipKLineResponseToRange({
          data: sharedData,
          timeFrom: params.timeFrom,
          timeTo: params.timeTo,
          targetCount: requestedTargetCount,
          includeEarlierPoints: true,
        });
      }
      return clipKLineResponseToRange({
        data: sharedData,
        timeFrom: params.timeFrom,
        timeTo: params.timeTo,
      });
    }

    if (!sharedData || !sharedDataIsSufficient) {
      removeKLineRequest(sharedRequest);
    }
    if (!retryAfterSharedFailure) {
      return sharedData;
    }
  }

  const promise = fetchTradingViewV2DataWithSlicingUncached(params);
  const request = trackKLineRequest({
    key,
    timeFrom: params.timeFrom,
    timeTo: params.timeTo,
    promise,
    retainCompletedResult,
    targetCount: params.targetCount,
    historyStartTime: params.historyStartTime,
    backgroundRequestId: params.requestId,
  });

  return request.promise;
}

export async function fetchTradingViewV2DataWithSlicing(
  params: ITradingViewV2Params,
): Promise<IMarketTokenKLineResponse | null> {
  const canCoalescePrimaryRequest =
    !params.primaryKLineDataUnavailable && !params.kLineDataFallback;
  if (!canCoalescePrimaryRequest) {
    return fetchTradingViewV2DataWithSlicingUncached(params);
  }

  return fetchTradingViewV2DataWithRequestReuse(params, {
    retryAfterSharedFailure: true,
    retainCompletedResult: false,
  });
}

function buildFirstScreenPrefetchResult({
  data,
  interval,
  timeFrom,
  timeTo,
}: {
  data: IMarketTokenKLineResponse | null;
  interval: string;
  timeFrom: number;
  timeTo: number;
}) {
  const coveredTimeFrom = data?.historyMeta?.coveredFrom;
  const coveredTimeTo = data?.historyMeta?.coveredTo;
  return {
    interval,
    requestedTimeFrom: timeFrom,
    requestedTimeTo: timeTo,
    coveredTimeFrom: Number.isFinite(coveredTimeFrom)
      ? (coveredTimeFrom ?? timeFrom)
      : timeFrom,
    coveredTimeTo: Number.isFinite(coveredTimeTo)
      ? (coveredTimeTo ?? timeTo)
      : timeTo,
    points: data?.points ?? [],
    historyMeta: data?.historyMeta,
    historyExhausted: data?.historyMeta?.noData === true,
  } satisfies ITradingViewV2FirstScreenPrefetchResult;
}

async function runTradingViewV2FirstScreenPrefetch({
  requestId,
  tokenAddress,
  networkId,
  kLineProvider = 'onekey',
  kLineProviderSymbol,
  interval = '1m',
  preferredHistorySeconds,
  preferredFutureSeconds,
  preferredCountBack,
  historyStartTime,
}: ITradingViewV2FirstScreenPrefetchParams & {
  requestId: string;
}): Promise<ITradingViewV2FirstScreenPrefetchResult | undefined> {
  if (!networkId) {
    return;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const normalizedInterval = normalizeKLineRequestInterval(interval);
  const isOneKeyNativeToken = kLineProvider === 'onekey' && !tokenAddress;
  const defaultTargetCount = isOneKeyNativeToken
    ? NATIVE_FIRST_SCREEN_KLINE_PREFETCH_BAR_COUNT
    : getFirstScreenKLinePrefetchTargetCount();
  // Prefer a viewport-complete first package over a 1-bar progressive stub.
  // Cap at the backend single-page limit so first paint does not wait on multi-page
  // left-history backfill that users only need after panning.
  const uncappedTargetCount = isOneKeyNativeToken
    ? defaultTargetCount
    : Math.max(
        normalizeKLineTargetCount(preferredCountBack) ?? 0,
        defaultTargetCount,
      );
  const targetCount = isOneKeyNativeToken
    ? uncappedTargetCount
    : Math.min(
        FIRST_SCREEN_KLINE_SINGLE_PAGE_MAX_BAR_COUNT,
        uncappedTargetCount,
      );
  const { timeFrom, timeTo } = getFirstScreenKLinePrefetchRange({
    nowSeconds,
    interval: normalizedInterval,
    isNativeToken: isOneKeyNativeToken,
    preferredHistorySeconds,
    preferredFutureSeconds,
    targetCount,
  });
  const data = await fetchTradingViewV2DataWithRequestReuse(
    {
      requestId,
      tokenAddress,
      networkId,
      kLineProvider,
      kLineProviderSymbol,
      interval: normalizedInterval,
      timeFrom,
      timeTo,
      targetCount,
      // Wait for a usable first-screen package instead of returning after 1 bar.
      stopAfterCount: targetCount,
      historyStartTime,
      autoHandleError: false,
      requestExactRange: true,
    },
    {
      retryAfterSharedFailure: false,
      retainCompletedResult: true,
    },
  );
  if (data?.historyMeta?.cancelled === true) {
    return undefined;
  }
  return buildFirstScreenPrefetchResult({
    data,
    interval: normalizedInterval,
    timeFrom,
    timeTo,
  });
}

export function prefetchTradingViewV2FirstScreenData(
  params: ITradingViewV2FirstScreenPrefetchParams,
): Promise<ITradingViewV2FirstScreenPrefetchResult | undefined> {
  if (!params.networkId) {
    return Promise.resolve(undefined);
  }

  pruneExpiredFirstScreenPrefetchRecords();
  const interval = normalizeKLineRequestInterval(params.interval ?? '1m');
  const key = buildKLineRequestKey({
    tokenAddress: params.tokenAddress,
    networkId: params.networkId,
    interval,
    kLineProvider: params.kLineProvider,
    kLineProviderSymbol: params.kLineProviderSymbol,
    historyStartTime: params.historyStartTime,
  });
  const existingRecord = firstScreenPrefetchRecords.get(key);
  if (existingRecord) {
    return existingRecord.latestResult
      ? Promise.resolve(existingRecord.latestResult)
      : existingRecord.promise;
  }
  cancelStaleFirstScreenPrefetchRecords(key);
  const backgroundRequestId = createFirstScreenPrefetchRequestId();
  const record: ITradingViewV2FirstScreenPrefetchRecord = {
    promise: Promise.resolve(undefined),
    backgroundRequestId,
    isInitialPending: true,
    expiresAt: Date.now() + FIRST_SCREEN_KLINE_PREFETCH_CACHE_TTL_MS,
  };
  const promise = runTradingViewV2FirstScreenPrefetch({
    ...params,
    interval,
    requestId: backgroundRequestId,
  });
  record.promise = promise;
  void promise
    .then((result) => {
      if (result && firstScreenPrefetchRecords.get(key) === record) {
        record.latestResult = result;
      }
    })
    .catch(() => {
      if (firstScreenPrefetchRecords.get(key) === record) {
        firstScreenPrefetchRecords.delete(key);
      }
    })
    .finally(() => {
      record.isInitialPending = false;
    });
  firstScreenPrefetchRecords.set(key, record);
  notifyFirstScreenPrefetchRecordSubscribers(key, record);
  if (
    firstScreenPrefetchRecords.size >
    MAX_FIRST_SCREEN_KLINE_PREFETCH_CACHE_ENTRIES
  ) {
    const oldestKey = firstScreenPrefetchRecords.keys().next().value;
    if (typeof oldestKey === 'string') {
      const oldestRecord = firstScreenPrefetchRecords.get(oldestKey);
      if (oldestRecord?.isInitialPending) {
        cancelFirstScreenPrefetchRecord(oldestKey, oldestRecord);
      } else {
        firstScreenPrefetchRecords.delete(oldestKey);
      }
    }
  }
  return promise;
}
