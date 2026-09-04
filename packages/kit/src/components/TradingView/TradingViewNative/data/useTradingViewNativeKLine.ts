import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getCurrentVisibilityState,
  onVisibilityStateChange,
} from '@onekeyhq/components/src/hooks/useVisibilityChange';
import { useInterval } from '@onekeyhq/kit/src/hooks/useInterval';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  getTradingViewNativeChartType,
  isTradingViewNativeSingleValueHistory,
} from '../utils/chartType';

import { createTradingViewNativeDataProvider } from './providers/createTradingViewNativeDataProvider';
import { logTradingViewNativeDataError } from './tradingViewNativeDataLogger';
import {
  emitTradingViewNativeDebugEvent,
  getTradingViewNativeDebugErrorMessage,
} from './tradingViewNativeDebugLogger';
import {
  TRADING_VIEW_NATIVE_KLINE_INTERVALS,
  TRADING_VIEW_NATIVE_TIME_RANGE_MAX_CANDLE_COUNT,
  getTradingViewNativeKLineInterval,
} from './tradingViewNativeIntervals';
import {
  getTradingViewNativeIntervalStorageNamespace,
  readTradingViewNativeActiveInterval,
  saveTradingViewNativeActiveInterval,
} from './tradingViewNativeIntervalStorage';

import type {
  ITradingViewNativeDataProvider,
  ITradingViewNativeHistoryRequest,
  ITradingViewNativeHistoryResponse,
  ITradingViewNativeRealtimeSubscription,
} from './providers/types';
import type {
  ITradingViewNativeChartInterval,
  ITradingViewNativeKLineInterval,
} from './tradingViewNativeIntervals';
import type { ITradingViewNativeIntervalStorageNamespace } from './tradingViewNativeIntervalStorage';
import type {
  ITradingViewNativeDataState,
  ITradingViewNativeSource,
} from '../types';
import type {
  ITradingViewNativeViewportRequest,
  ITradingViewNativeViewportTarget,
} from '../utils/chartViewport';

const HISTORY_GAP_SEARCH_PADDING_POINT_COUNT = 20;
const HISTORY_NEWER_LOAD_MORE_THRESHOLD = 20;
const HISTORY_OLDER_LOAD_MORE_FALLBACK_THRESHOLD = 20;
const HISTORY_OLDER_LOAD_MORE_FALLBACK_TARGET_POINT_COUNT = Math.ceil(
  TRADING_VIEW_NATIVE_TIME_RANGE_MAX_CANDLE_COUNT / 2,
);
const HISTORY_GAP_REQUEST_CANDLE_COUNT = 100;
const HISTORY_GAP_EMPTY_SCAN_PAGE_COUNT = 4;
const HISTORY_BOUNDARY_PREFETCH_CACHE_MAX_SIZE = 100;
const HISTORY_BOUNDARY_PREFETCH_CACHE_TTL = 24 * 60 * 60 * 1000;
const HISTORY_BOUNDARY_SEARCH_INTERVAL_VALUE: ITradingViewNativeChartInterval =
  '1W';
const HISTORY_RETRY_DELAYS = [1000, 3000] as const;
const MAX_SPARSE_HISTORY_CONSECUTIVE_EMPTY_WINDOW_COUNT = 25;
const MAX_SPARSE_HISTORY_REQUEST_ATTEMPT_COUNT = 100;
const MAX_VIEWPORT_HISTORY_PAGE_COUNT = 20;
const MAX_VIEWPORT_HISTORY_BOUNDARY_SEARCH_COUNT = 32;
const MAX_REALTIME_BUFFER_CANDLES = 160;
const REALTIME_SELF_HEAL_INTERVAL = 30_000;
const REALTIME_STALE_THRESHOLD = 60_000;
// Native Market history is capped at 200 points. Keep two slots before the
// target so a newest-page response still retains the requested candle.
const VIEWPORT_TARGET_FORWARD_CANDLE_COUNT =
  TRADING_VIEW_NATIVE_TIME_RANGE_MAX_CANDLE_COUNT;

let realtimeSubscriberSequence = 0;
let historyDebugRequestSequence = 0;

function getHistoryPointTypeScopeKey(
  seriesKey: string,
  interval: ITradingViewNativeChartInterval,
) {
  return `${seriesKey}:${interval}`;
}

type IHistoryDataSource = 'fallback' | 'primary';
type IHistoryPointTypeClassification = 'fallbackSingle' | 'ohlc' | 'single';

function resolveHistoryPointTypeClassification({
  currentClassification,
  historySource,
  pointType,
}: {
  currentClassification?: IHistoryPointTypeClassification;
  historySource?: 'fallback';
  pointType?: ITradingViewNativeHistoryResponse['pointType'];
}): IHistoryPointTypeClassification {
  if (isTradingViewNativeSingleValueHistory(pointType)) {
    if (historySource === 'fallback') {
      // A fallback page may fill an isolated gap, so it cannot replace a
      // chart type already established by the primary history source.
      return currentClassification ?? 'fallbackSingle';
    }
    return 'single';
  }
  return currentClassification === 'single' ? 'single' : 'ohlc';
}

function isSingleValueHistoryClassification(
  classification?: IHistoryPointTypeClassification,
) {
  return classification === 'fallbackSingle' || classification === 'single';
}

interface IChartData {
  chartPictureVersion: number;
  interval: ITradingViewNativeChartInterval;
  seriesKey: string;
  points: IMarketTokenKLineDataPoint[];
}

interface IHistoryState {
  error?: unknown;
  interval: ITradingViewNativeChartInterval;
  lastUpdatedAt?: number;
  seriesKey: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
}

interface IRealtimeState {
  error?: unknown;
  interval: ITradingViewNativeChartInterval;
  lastUpdatedAt?: number;
  seriesKey: string;
  status: 'idle' | 'connecting' | 'live' | 'reconnecting' | 'error';
}

interface IHistoryPaginationState {
  abortController?: AbortController;
  earliestTimestamp?: number;
  hasMore: boolean;
  hasMoreAfter: boolean;
  interval: ITradingViewNativeChartInterval;
  isLoading: boolean;
  newerCursorTimestamp?: number;
  seriesKey: string;
}

interface IActiveIntervalState {
  interval: ITradingViewNativeChartInterval;
  namespace: ITradingViewNativeIntervalStorageNamespace;
}

interface IHistoryCoverageRange {
  from: number;
  to: number;
}

interface IHistoryCoverageState {
  interval: ITradingViewNativeChartInterval;
  ranges: IHistoryCoverageRange[];
  seriesKey: string;
}

interface IHistoryBoundaryPrefetchPage {
  earliestTimestamp?: number;
  hasMoreBefore: boolean;
  historySource?: 'fallback';
  points: IMarketTokenKLineDataPoint[];
  timeFrom: number;
  timeTo: number;
}

interface IHistoryBoundaryAvailableTimeRange {
  from: number;
  seriesKey: string;
}

interface IHistoryBoundaryPrefetchCacheEntry {
  expiresAt: number;
  page: IHistoryBoundaryPrefetchPage;
}

interface IHistoryBoundaryTimestampCacheEntry {
  earliestTimestamp: number;
  expiresAt: number;
}

interface IHistoryBoundaryPrefetchRequest {
  abortController: AbortController;
  promise: Promise<IHistoryBoundaryPrefetchPage | null>;
}

interface IHistoryGapRecoveryResult {
  boundaryTimestamp: number;
  cursorTimestamp: number;
  hasMoreBefore: boolean;
  historySource?: 'fallback';
  points: IMarketTokenKLineDataPoint[];
}

interface IHistoryGapRecoveryProgressOptions {
  coverageState: IHistoryCoverageState;
  interval: ITradingViewNativeChartInterval;
  intervalSeconds: number;
  isActive: () => boolean;
  onPoints: (points: IMarketTokenKLineDataPoint[]) => void;
  pagination: IHistoryPaginationState;
  seriesKey: string;
  timeTo: number;
}

interface IScopedVisiblePointRange {
  endIndex: number;
  interval: ITradingViewNativeChartInterval;
  seriesKey: string;
  startIndex: number;
}

interface IScopedViewportRequest extends ITradingViewNativeViewportRequest {
  interval: ITradingViewNativeChartInterval;
  seriesKey: string;
}

const historyBoundaryPrefetchCache = new Map<
  string,
  IHistoryBoundaryPrefetchCacheEntry
>();
const historyBoundaryPrefetchRequests = new Map<
  string,
  IHistoryBoundaryPrefetchRequest
>();
const historyBoundaryTimestampCache = new Map<
  string,
  IHistoryBoundaryTimestampCacheEntry
>();

export function clearTradingViewNativeHistoryBoundaryPrefetchCache() {
  historyBoundaryPrefetchRequests.forEach(({ abortController }) => {
    abortController.abort();
  });
  historyBoundaryPrefetchRequests.clear();
  historyBoundaryPrefetchCache.clear();
  historyBoundaryTimestampCache.clear();
}

function normalizeKLinePoints(points: IMarketTokenKLineDataPoint[]) {
  return points
    .filter(
      (point) =>
        Number.isFinite(point.o) &&
        Number.isFinite(point.h) &&
        Number.isFinite(point.l) &&
        Number.isFinite(point.c) &&
        Number.isFinite(point.t) &&
        point.h >= point.l,
    )
    .toSorted((a, b) => a.t - b.t);
}

function normalizeKLinePointsInRange({
  from,
  points,
  to,
}: {
  from: number;
  points: IMarketTokenKLineDataPoint[];
  to: number;
}) {
  return normalizeKLinePoints(points).filter(
    (point) => point.t >= from && point.t <= to,
  );
}

function mergeKLinePoints(
  points: IMarketTokenKLineDataPoint[],
  incomingPoints: Iterable<IMarketTokenKLineDataPoint>,
) {
  const pointsByTimestamp = new Map<number, IMarketTokenKLineDataPoint>();
  points.forEach((point) => pointsByTimestamp.set(point.t, point));
  for (const incomingPoint of incomingPoints) {
    pointsByTimestamp.set(incomingPoint.t, incomingPoint);
  }
  return normalizeKLinePoints([...pointsByTimestamp.values()]);
}

function mergeScopedChartDataPoints({
  currentData,
  interval,
  points,
  seriesKey,
}: {
  currentData: IChartData | null;
  interval: ITradingViewNativeChartInterval;
  points: IMarketTokenKLineDataPoint[];
  seriesKey: string;
}) {
  if (
    !points.length ||
    currentData?.seriesKey !== seriesKey ||
    currentData.interval !== interval
  ) {
    return currentData;
  }
  return {
    ...currentData,
    chartPictureVersion: currentData.chartPictureVersion + 1,
    points: mergeKLinePoints(currentData.points, points),
  };
}

function areKLinePointsEqual(
  first: IMarketTokenKLineDataPoint,
  second: IMarketTokenKLineDataPoint,
) {
  return (
    first.o === second.o &&
    first.h === second.h &&
    first.l === second.l &&
    first.c === second.c &&
    first.v === second.v &&
    first.t === second.t
  );
}

function mergeRealtimePoint(
  points: IMarketTokenKLineDataPoint[],
  realtimePoint: IMarketTokenKLineDataPoint,
) {
  const latestPointIndex = points.length - 1;
  const existingPointIndex =
    points[latestPointIndex]?.t === realtimePoint.t
      ? latestPointIndex
      : points.findIndex((point) => point.t === realtimePoint.t);
  if (existingPointIndex === -1) {
    return {
      didChangeHistoricalPoints: true,
      points: normalizeKLinePoints([...points, realtimePoint]),
    };
  }
  if (areKLinePointsEqual(points[existingPointIndex], realtimePoint)) {
    return { didChangeHistoricalPoints: false, points };
  }

  const nextPoints = [...points];
  nextPoints[existingPointIndex] = realtimePoint;
  return {
    didChangeHistoricalPoints: existingPointIndex !== latestPointIndex,
    points: nextPoints,
  };
}

function bufferRealtimePoint(
  buffer: Map<number, IMarketTokenKLineDataPoint>,
  point: IMarketTokenKLineDataPoint,
) {
  buffer.set(point.t, point);
  if (buffer.size <= MAX_REALTIME_BUFFER_CANDLES) {
    return;
  }

  let oldestTimestamp = Number.POSITIVE_INFINITY;
  buffer.forEach((_bufferedPoint, timestamp) => {
    oldestTimestamp = Math.min(oldestTimestamp, timestamp);
  });
  buffer.delete(oldestTimestamp);
}

function mergeRealtimePointBuffer(
  points: IMarketTokenKLineDataPoint[],
  realtimePoints: Iterable<IMarketTokenKLineDataPoint>,
) {
  return mergeKLinePoints(points, realtimePoints);
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

function getHasPotentialEarlierHistory({
  earliestTimestamp,
  historyBoundaryTimestamp,
  historySource,
  pageHasMoreHistory,
  sourceKind,
}: {
  earliestTimestamp?: number;
  historyBoundaryTimestamp?: number;
  historySource?: 'fallback';
  pageHasMoreHistory: boolean;
  sourceKind: ITradingViewNativeSource['kind'];
}) {
  if (sourceKind === 'market' && historySource !== 'fallback') {
    // A short Market page only exhausts its requested time window. Sparse
    // tokens may still have candles before that window.
    return (
      earliestTimestamp !== undefined &&
      earliestTimestamp > (historyBoundaryTimestamp ?? 0)
    );
  }
  return pageHasMoreHistory;
}

function getOlderHistoryPreloadPointCount({
  endIndex,
  startIndex,
}: {
  endIndex?: number;
  startIndex: number;
}) {
  if (!Number.isFinite(startIndex)) {
    return 0;
  }

  const loadedPointCountBeforeViewport = Math.max(Math.floor(startIndex), 0);
  if (endIndex === undefined) {
    return loadedPointCountBeforeViewport <=
      HISTORY_OLDER_LOAD_MORE_FALLBACK_THRESHOLD
      ? HISTORY_OLDER_LOAD_MORE_FALLBACK_TARGET_POINT_COUNT
      : 0;
  }
  if (!Number.isFinite(endIndex)) {
    return 0;
  }
  const visiblePointCount = Math.max(
    Math.ceil(endIndex) - Math.floor(startIndex),
    1,
  );
  const preloadTriggerPointCount = Math.ceil(visiblePointCount / 2);
  if (loadedPointCountBeforeViewport > preloadTriggerPointCount) {
    return 0;
  }

  return Math.max(visiblePointCount - loadedPointCountBeforeViewport, 0);
}

function getHistoryBoundaryPrefetchCacheKey(seriesKey: string) {
  return `${seriesKey}:${HISTORY_BOUNDARY_SEARCH_INTERVAL_VALUE}`;
}

function getHistoryBoundarySearchInterval() {
  return (
    getTradingViewNativeKLineInterval(HISTORY_BOUNDARY_SEARCH_INTERVAL_VALUE) ??
    TRADING_VIEW_NATIVE_KLINE_INTERVALS[7]
  );
}

function getCachedHistoryBoundaryTimestamp(cacheKey: string) {
  const entry = historyBoundaryTimestampCache.get(cacheKey);
  if (!entry) {
    return undefined;
  }
  if (entry.expiresAt <= Date.now()) {
    historyBoundaryTimestampCache.delete(cacheKey);
    return undefined;
  }

  historyBoundaryTimestampCache.delete(cacheKey);
  historyBoundaryTimestampCache.set(cacheKey, entry);
  return entry.earliestTimestamp;
}

function cacheHistoryBoundaryTimestamp({
  cacheKey,
  earliestTimestamp,
}: {
  cacheKey: string;
  earliestTimestamp: number;
}) {
  if (!Number.isFinite(earliestTimestamp)) {
    return;
  }
  historyBoundaryTimestampCache.delete(cacheKey);
  historyBoundaryTimestampCache.set(cacheKey, {
    earliestTimestamp,
    expiresAt: Date.now() + HISTORY_BOUNDARY_PREFETCH_CACHE_TTL,
  });
  while (
    historyBoundaryTimestampCache.size >
    HISTORY_BOUNDARY_PREFETCH_CACHE_MAX_SIZE
  ) {
    const oldestCacheKey = historyBoundaryTimestampCache.keys().next().value;
    if (!oldestCacheKey) {
      break;
    }
    historyBoundaryTimestampCache.delete(oldestCacheKey);
  }
}

function getCachedHistoryBoundaryPrefetchPage(cacheKey: string) {
  const entry = historyBoundaryPrefetchCache.get(cacheKey);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    historyBoundaryPrefetchCache.delete(cacheKey);
    return null;
  }

  historyBoundaryPrefetchCache.delete(cacheKey);
  historyBoundaryPrefetchCache.set(cacheKey, entry);
  return entry.page;
}

function cacheHistoryBoundaryPrefetchPage({
  cacheKey,
  page,
}: {
  cacheKey: string;
  page: IHistoryBoundaryPrefetchPage;
}) {
  historyBoundaryPrefetchCache.delete(cacheKey);
  historyBoundaryPrefetchCache.set(cacheKey, {
    expiresAt: Date.now() + HISTORY_BOUNDARY_PREFETCH_CACHE_TTL,
    page,
  });
  while (
    historyBoundaryPrefetchCache.size > HISTORY_BOUNDARY_PREFETCH_CACHE_MAX_SIZE
  ) {
    const oldestCacheKey = historyBoundaryPrefetchCache.keys().next().value;
    if (!oldestCacheKey) {
      break;
    }
    historyBoundaryPrefetchCache.delete(oldestCacheKey);
  }
}

function getHistoryBoundaryPrefetchPage(
  seriesKey: string,
): Promise<IHistoryBoundaryPrefetchPage | null> | null {
  const cacheKey = getHistoryBoundaryPrefetchCacheKey(seriesKey);
  const cachedPage = getCachedHistoryBoundaryPrefetchPage(cacheKey);
  if (cachedPage) {
    return Promise.resolve(cachedPage);
  }
  return historyBoundaryPrefetchRequests.get(cacheKey)?.promise ?? null;
}

interface IHistoryRequestAttemptBudget {
  remainingAttemptCount: number;
}

class HistoryRequestAttemptBudgetExhaustedError extends OneKeyLocalError {}

function createSparseHistoryRequestAttemptBudget(): IHistoryRequestAttemptBudget {
  return {
    remainingAttemptCount: MAX_SPARSE_HISTORY_REQUEST_ATTEMPT_COUNT,
  };
}

function consumeHistoryRequestAttempt(
  requestAttemptBudget?: IHistoryRequestAttemptBudget,
) {
  if (!requestAttemptBudget) {
    return;
  }
  if (requestAttemptBudget.remainingAttemptCount <= 0) {
    throw new HistoryRequestAttemptBudgetExhaustedError(
      'Sparse history request attempt budget exhausted',
    );
  }
  requestAttemptBudget.remainingAttemptCount -= 1;
}

async function fetchRequiredHistoryPage({
  historyProvider,
  request,
  requestAttemptBudget,
  unavailableMessage,
}: {
  historyProvider: ITradingViewNativeDataProvider;
  request: ITradingViewNativeHistoryRequest;
  requestAttemptBudget?: IHistoryRequestAttemptBudget;
  unavailableMessage: string;
}): Promise<ITradingViewNativeHistoryResponse> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= HISTORY_RETRY_DELAYS.length; attempt += 1) {
    consumeHistoryRequestAttempt(requestAttemptBudget);
    try {
      const data = await historyProvider.fetchHistory(request);
      if (!data) {
        throw new OneKeyLocalError(unavailableMessage);
      }
      return data;
    } catch (error) {
      if (request.signal.aborted || isAbortError(error)) {
        throw error;
      }
      lastError = error;
      const retryDelay = HISTORY_RETRY_DELAYS[attempt];
      if (retryDelay === undefined) {
        break;
      }
      if (requestAttemptBudget?.remainingAttemptCount === 0) {
        throw new HistoryRequestAttemptBudgetExhaustedError(
          'Sparse history request attempt budget exhausted',
        );
      }
      await waitForHistoryRetry(retryDelay, request.signal);
      if (request.signal.aborted) {
        throw error;
      }
    }
  }

  throw lastError ?? new OneKeyLocalError(unavailableMessage);
}

function prefetchHistoryBoundaryPage({
  historyProvider,
  requestAttemptBudget,
  seriesKey,
}: {
  historyProvider: ITradingViewNativeDataProvider;
  requestAttemptBudget?: IHistoryRequestAttemptBudget;
  seriesKey: string;
}) {
  const cacheKey = getHistoryBoundaryPrefetchCacheKey(seriesKey);
  const existingPage = getCachedHistoryBoundaryPrefetchPage(cacheKey);
  if (existingPage) {
    return Promise.resolve(existingPage);
  }
  const existingRequest = historyBoundaryPrefetchRequests.get(cacheKey);
  if (existingRequest) {
    return existingRequest.promise;
  }

  const coarsestInterval = getHistoryBoundarySearchInterval();
  const abortController = new AbortController();
  const timeFrom = 0;
  const timeTo = Math.floor(Date.now() / 1000);
  const promise = Promise.resolve()
    .then(async () => {
      let hasMoreBefore = true;
      let historySource: 'fallback' | undefined;
      let oldestPagePoints: IMarketTokenKLineDataPoint[] = [];
      let oldestPageTimeTo = timeTo;
      for (
        let pageIndex = 0;
        pageIndex < MAX_VIEWPORT_HISTORY_PAGE_COUNT;
        pageIndex += 1
      ) {
        const data = await fetchRequiredHistoryPage({
          historyProvider,
          request: {
            interval: coarsestInterval,
            signal: abortController.signal,
            timeFrom,
            timeTo: oldestPageTimeTo,
          },
          requestAttemptBudget,
          unavailableMessage:
            'No weekly candle history response is available for boundary prefetch',
        });
        if (abortController.signal.aborted) {
          return null;
        }
        const pagePoints = normalizeKLinePointsInRange({
          from: timeFrom,
          points: data.points,
          to: oldestPageTimeTo,
        });
        if (!pagePoints.length) {
          hasMoreBefore = false;
          break;
        }

        historySource = data.historySource;
        oldestPagePoints = pagePoints;
        hasMoreBefore = historyProvider.hasMoreHistory({
          historySource: data.historySource,
          interval: coarsestInterval,
          receivedPointCount: pagePoints.length,
        });
        if (!hasMoreBefore) {
          break;
        }

        const nextPageTimeTo = pagePoints[0].t - 1;
        if (nextPageTimeTo <= timeFrom || nextPageTimeTo >= oldestPageTimeTo) {
          break;
        }
        oldestPageTimeTo = nextPageTimeTo;
      }
      if (!oldestPagePoints.length) {
        return null;
      }

      if (hasMoreBefore) {
        return {
          hasMoreBefore: true,
          historySource,
          points: oldestPagePoints,
          timeFrom,
          timeTo: oldestPageTimeTo,
        };
      }

      const dailyInterval = TRADING_VIEW_NATIVE_KLINE_INTERVALS.find(
        (interval) => interval.value === '1D',
      );
      const firstWeeklyTimestamp = oldestPagePoints[0]?.t;
      if (!dailyInterval || firstWeeklyTimestamp === undefined) {
        return null;
      }
      const dailyTimeFrom = Math.max(
        firstWeeklyTimestamp - dailyInterval.seconds,
        0,
      );
      const dailyTimeTo = Math.min(
        firstWeeklyTimestamp + coarsestInterval.seconds + dailyInterval.seconds,
        timeTo,
      );
      const dailyData = await fetchRequiredHistoryPage({
        historyProvider,
        request: {
          interval: dailyInterval,
          signal: abortController.signal,
          timeFrom: dailyTimeFrom,
          timeTo: dailyTimeTo,
        },
        requestAttemptBudget,
        unavailableMessage:
          'No daily candle history response is available for boundary refinement',
      });
      if (abortController.signal.aborted) {
        return null;
      }
      const earliestTimestamp = normalizeKLinePointsInRange({
        from: dailyTimeFrom,
        points: dailyData.points,
        to: dailyTimeTo,
      })[0]?.t;
      if (earliestTimestamp === undefined) {
        throw new OneKeyLocalError(
          'No daily candle is available for boundary refinement',
        );
      }

      const page: IHistoryBoundaryPrefetchPage = {
        earliestTimestamp,
        hasMoreBefore: false,
        historySource,
        points: oldestPagePoints,
        timeFrom,
        timeTo: oldestPageTimeTo,
      };
      cacheHistoryBoundaryPrefetchPage({ cacheKey, page });
      cacheHistoryBoundaryTimestamp({
        cacheKey,
        earliestTimestamp,
      });
      return page;
    })
    .catch((error: unknown) => {
      if (
        !abortController.signal.aborted &&
        !isAbortError(error) &&
        !(error instanceof HistoryRequestAttemptBudgetExhaustedError)
      ) {
        logTradingViewNativeDataError(
          'Failed to prefetch native TradingView history boundary',
          error,
        );
      }
      return null;
    })
    .finally(() => {
      const request = historyBoundaryPrefetchRequests.get(cacheKey);
      if (request?.abortController === abortController) {
        historyBoundaryPrefetchRequests.delete(cacheKey);
      }
    });
  historyBoundaryPrefetchRequests.set(cacheKey, {
    abortController,
    promise,
  });
  return promise;
}

async function recoverOlderHistoryFromBoundary({
  historyProvider,
  initialConsecutiveEmptyWindowCount = 0,
  interval,
  onProgress,
  requestAttemptBudget,
  seriesKey,
  signal,
  targetPointCount,
  timeTo,
}: {
  historyProvider: ITradingViewNativeDataProvider;
  initialConsecutiveEmptyWindowCount?: number;
  interval: ITradingViewNativeKLineInterval;
  onProgress?: (result: IHistoryGapRecoveryResult) => void;
  requestAttemptBudget: IHistoryRequestAttemptBudget;
  seriesKey: string;
  signal: AbortSignal;
  targetPointCount: number;
  timeTo: number;
}): Promise<IHistoryGapRecoveryResult | null> {
  const boundaryPage = await (getHistoryBoundaryPrefetchPage(seriesKey) ??
    prefetchHistoryBoundaryPage({
      historyProvider,
      requestAttemptBudget,
      seriesKey,
    }));
  if (
    signal.aborted ||
    !boundaryPage ||
    boundaryPage.hasMoreBefore ||
    boundaryPage.earliestTimestamp === undefined
  ) {
    return null;
  }

  const boundaryTimestamp = boundaryPage.earliestTimestamp;
  if (boundaryTimestamp > timeTo) {
    return {
      boundaryTimestamp,
      cursorTimestamp: boundaryTimestamp,
      hasMoreBefore: false,
      points: [],
    };
  }

  let cursorTimeTo = Math.floor(timeTo);
  let cursorTimestamp = cursorTimeTo + 1;
  let consecutiveEmptyWindowCount = Math.max(
    Math.floor(initialConsecutiveEmptyWindowCount),
    0,
  );
  let historySource: 'fallback' | undefined;
  let points: IMarketTokenKLineDataPoint[] = [];
  const normalizedTargetPointCount = Math.max(Math.floor(targetPointCount), 1);
  const requestCandleCount = Math.max(
    Math.floor(historyProvider.getHistoryRequestCandleCount(interval)),
    1,
  );
  const buildResult = (): IHistoryGapRecoveryResult => ({
    boundaryTimestamp,
    cursorTimestamp,
    hasMoreBefore: cursorTimestamp > boundaryTimestamp,
    historySource,
    points,
  });

  while (
    cursorTimeTo >= boundaryTimestamp &&
    points.length < normalizedTargetPointCount &&
    consecutiveEmptyWindowCount <
      MAX_SPARSE_HISTORY_CONSECUTIVE_EMPTY_WINDOW_COUNT &&
    requestAttemptBudget.remainingAttemptCount > 0
  ) {
    const rangeTimeTo = cursorTimeTo;
    const rangeTimeFrom = Math.max(
      getHistoryTimeFrom({
        candleCount: requestCandleCount,
        intervalSeconds: interval.seconds,
        timeTo: rangeTimeTo,
      }),
      boundaryTimestamp,
    );
    let data: ITradingViewNativeHistoryResponse;
    try {
      data = await fetchRequiredHistoryPage({
        historyProvider,
        request: {
          interval,
          signal,
          timeFrom: rangeTimeFrom,
          timeTo: rangeTimeTo,
        },
        requestAttemptBudget,
        unavailableMessage:
          'No candle history response is available for sparse history recovery',
      });
    } catch (error) {
      if (error instanceof HistoryRequestAttemptBudgetExhaustedError) {
        break;
      }
      throw error;
    }
    if (signal.aborted) {
      return null;
    }

    historySource = data.historySource;
    if (historySource === 'fallback') {
      return {
        boundaryTimestamp,
        cursorTimestamp: boundaryTimestamp,
        hasMoreBefore: false,
        historySource,
        points: [],
      };
    }

    const rangePoints = normalizeKLinePointsInRange({
      from: rangeTimeFrom,
      points: data.points,
      to: rangeTimeTo,
    });
    consecutiveEmptyWindowCount = rangePoints.length
      ? 0
      : consecutiveEmptyWindowCount + 1;
    points = mergeKLinePoints(points, rangePoints);
    const rangeMayBeTruncated = historyProvider.hasMoreHistory({
      historySource,
      interval,
      receivedPointCount: rangePoints.length,
    });

    // A short page only exhausts its requested time window. Keep walking older
    // windows until the next-screen target, the real history boundary, or the
    // consecutive-empty safety limit is met.
    // A capped page resumes from its earliest returned candle without splitting
    // and refetching the same range.
    cursorTimestamp = rangeMayBeTruncated
      ? (rangePoints[0]?.t ?? rangeTimeFrom)
      : rangeTimeFrom;
    cursorTimeTo = cursorTimestamp - 1;
    onProgress?.(buildResult());
  }

  return buildResult();
}

function waitForHistoryRetry(delay: number, signal: AbortSignal) {
  if (signal.aborted) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const timeoutState: { timer?: ReturnType<typeof setTimeout> } = {};
    const finish = () => {
      if (timeoutState.timer !== undefined) {
        clearTimeout(timeoutState.timer);
      }
      signal.removeEventListener('abort', finish);
      resolve();
    };
    timeoutState.timer = setTimeout(finish, delay);
    signal.addEventListener('abort', finish, { once: true });
  });
}

function getLatestTimestamp(...timestamps: (number | undefined)[]) {
  const validTimestamps = timestamps.filter(
    (timestamp): timestamp is number => timestamp !== undefined,
  );
  return validTimestamps.length ? Math.max(...validTimestamps) : undefined;
}

function getHistoryTimeFrom({
  candleCount,
  intervalSeconds,
  timeTo,
}: {
  candleCount: number;
  intervalSeconds: number;
  timeTo: number;
}) {
  return Math.max(timeTo - intervalSeconds * candleCount, 0);
}

async function findFirstHistoryPageAtOrAfterByBinarySearch({
  historyProvider,
  interval,
  knownPoint,
  signal,
  timeFrom,
}: {
  historyProvider: ITradingViewNativeDataProvider;
  interval: ITradingViewNativeKLineInterval;
  knownPoint: IMarketTokenKLineDataPoint;
  signal: AbortSignal;
  timeFrom: number;
}) {
  let lowerBound = Math.max(Math.floor(timeFrom), 0);
  let upperBound = knownPoint.t;
  let candidateHistorySource: 'fallback' | undefined;
  let candidatePoints = [knownPoint];
  const minimumSearchSpan = Math.max(Math.floor(interval.seconds), 1);

  // Market history returns the newest capped page inside a range. Binary
  // probing finds the first non-empty candle without downloading every page.
  for (
    let searchIndex = 0;
    searchIndex < MAX_VIEWPORT_HISTORY_BOUNDARY_SEARCH_COUNT &&
    upperBound - lowerBound > minimumSearchSpan;
    searchIndex += 1
  ) {
    const timeTo = lowerBound + Math.floor((upperBound - lowerBound) / 2);
    if (timeTo <= lowerBound || timeTo >= upperBound) {
      break;
    }

    const data = await fetchRequiredHistoryPage({
      historyProvider,
      request: {
        interval,
        signal,
        timeFrom: lowerBound,
        timeTo,
      },
      unavailableMessage:
        'No candle history response is available for boundary search',
    });
    if (signal.aborted) {
      return null;
    }

    const points = normalizeKLinePointsInRange({
      from: lowerBound,
      points: data.points,
      to: timeTo,
    });
    if (points.length) {
      candidateHistorySource = data.historySource;
      candidatePoints = points;
      upperBound = points[0].t;
    } else {
      lowerBound = timeTo + 1;
    }
  }

  return {
    historySource: candidateHistorySource,
    points: candidatePoints,
    timestamp: upperBound,
  };
}

async function findFirstHistoryPageAtOrAfter({
  historyProvider,
  interval,
  knownPoint,
  prefetchedCoarsestPage,
  signal,
  timeFrom,
}: {
  historyProvider: ITradingViewNativeDataProvider;
  interval: ITradingViewNativeKLineInterval;
  knownPoint: IMarketTokenKLineDataPoint;
  prefetchedCoarsestPage?: IHistoryBoundaryPrefetchPage | null;
  signal: AbortSignal;
  timeFrom: number;
}) {
  const coarsestInterval = getHistoryBoundarySearchInterval();
  const activeIntervalIndex = TRADING_VIEW_NATIVE_KLINE_INTERVALS.findIndex(
    (candidate) => candidate.value === interval.value,
  );
  const coarsestIntervalIndex = TRADING_VIEW_NATIVE_KLINE_INTERVALS.findIndex(
    (candidate) => candidate.value === coarsestInterval.value,
  );
  if (
    activeIntervalIndex < 0 ||
    coarsestIntervalIndex < 0 ||
    activeIntervalIndex >= coarsestIntervalIndex
  ) {
    return findFirstHistoryPageAtOrAfterByBinarySearch({
      historyProvider,
      interval,
      knownPoint,
      signal,
      timeFrom,
    });
  }

  let boundaryHistorySource: 'fallback' | undefined;
  let boundaryPoints: IMarketTokenKLineDataPoint[] = [];
  const reusablePrefetchedPage =
    prefetchedCoarsestPage &&
    prefetchedCoarsestPage.points.length > 0 &&
    prefetchedCoarsestPage.timeFrom <= timeFrom &&
    prefetchedCoarsestPage.timeTo >= timeFrom
      ? prefetchedCoarsestPage
      : null;
  let pageTimeTo = reusablePrefetchedPage?.timeTo ?? knownPoint.t;
  let reachedBoundary = false;
  for (
    let pageIndex = 0;
    pageIndex < MAX_VIEWPORT_HISTORY_PAGE_COUNT;
    pageIndex += 1
  ) {
    const data =
      pageIndex === 0 && reusablePrefetchedPage
        ? reusablePrefetchedPage
        : await fetchRequiredHistoryPage({
            historyProvider,
            request: {
              interval: coarsestInterval,
              signal,
              timeFrom,
              timeTo: pageTimeTo,
            },
            unavailableMessage:
              'No weekly candle history response is available for boundary search',
          });
    if (signal.aborted) {
      return null;
    }

    const pagePoints = normalizeKLinePointsInRange({
      from: Math.max(timeFrom - coarsestInterval.seconds, 0),
      points: data.points,
      to: pageTimeTo,
    });
    if (!pagePoints.length) {
      reachedBoundary = boundaryPoints.length > 0;
      break;
    }

    boundaryHistorySource = data.historySource;
    boundaryPoints = pagePoints;
    const hasMoreHistory = historyProvider.hasMoreHistory({
      historySource: data.historySource,
      interval: coarsestInterval,
      receivedPointCount: pagePoints.length,
    });
    if (!hasMoreHistory) {
      reachedBoundary = true;
      break;
    }

    const nextPageTimeTo = pagePoints[0].t - 1;
    if (nextPageTimeTo <= timeFrom || nextPageTimeTo >= pageTimeTo) {
      reachedBoundary = true;
      break;
    }
    pageTimeTo = nextPageTimeTo;
  }

  if (!reachedBoundary || !boundaryPoints.length) {
    return findFirstHistoryPageAtOrAfterByBinarySearch({
      historyProvider,
      interval,
      knownPoint,
      signal,
      timeFrom,
    });
  }

  let boundaryTimestamp = boundaryPoints[0].t;
  let parentInterval = coarsestInterval;
  const refinementIntervals = TRADING_VIEW_NATIVE_KLINE_INTERVALS.slice(
    activeIntervalIndex,
    coarsestIntervalIndex,
  ).toReversed();
  for (const refinementInterval of refinementIntervals) {
    const requestTimeFrom = Math.max(
      boundaryTimestamp - parentInterval.seconds,
      0,
    );
    const requestTimeTo = boundaryTimestamp + parentInterval.seconds;
    const data = await fetchRequiredHistoryPage({
      historyProvider,
      request: {
        interval: refinementInterval,
        signal,
        timeFrom: requestTimeFrom,
        timeTo: requestTimeTo,
      },
      unavailableMessage:
        'No candle history response is available for boundary refinement',
    });
    if (signal.aborted) {
      return null;
    }

    const refinedPoints = normalizeKLinePointsInRange({
      from: Math.max(timeFrom - refinementInterval.seconds, requestTimeFrom, 0),
      points: data.points,
      to: requestTimeTo,
    });
    if (!refinedPoints.length) {
      return findFirstHistoryPageAtOrAfterByBinarySearch({
        historyProvider,
        interval,
        knownPoint,
        signal,
        timeFrom,
      });
    }

    boundaryHistorySource = data.historySource;
    boundaryPoints = refinedPoints;
    boundaryTimestamp = refinedPoints[0].t;
    parentInterval = refinementInterval;
  }

  return {
    historySource: boundaryHistorySource,
    points: boundaryPoints,
    timestamp: boundaryTimestamp,
  };
}

function mergeHistoryCoverageRanges({
  incomingRange,
  intervalSeconds,
  ranges,
}: {
  incomingRange: IHistoryCoverageRange;
  intervalSeconds: number;
  ranges: IHistoryCoverageRange[];
}) {
  const normalizedIncomingRange = {
    from: Math.min(incomingRange.from, incomingRange.to),
    to: Math.max(incomingRange.from, incomingRange.to),
  };
  if (
    !Number.isFinite(normalizedIncomingRange.from) ||
    !Number.isFinite(normalizedIncomingRange.to)
  ) {
    return ranges;
  }

  const mergeTolerance = Math.max(intervalSeconds * 2, 1);
  const sortedRanges = [...ranges, normalizedIncomingRange].toSorted(
    (first, second) => first.from - second.from,
  );
  const mergedRanges: IHistoryCoverageRange[] = [];
  for (const range of sortedRanges) {
    const previousRange = mergedRanges[mergedRanges.length - 1];
    if (!previousRange || range.from > previousRange.to + mergeTolerance) {
      mergedRanges.push({ ...range });
    } else {
      previousRange.to = Math.max(previousRange.to, range.to);
    }
  }
  return mergedRanges;
}

function addHistoryCoverageRange({
  coverageState,
  from,
  interval,
  intervalSeconds,
  seriesKey,
  to,
}: {
  coverageState: IHistoryCoverageState;
  from: number | undefined;
  interval: ITradingViewNativeChartInterval;
  intervalSeconds: number;
  seriesKey: string;
  to: number | undefined;
}) {
  if (
    coverageState.seriesKey !== seriesKey ||
    coverageState.interval !== interval ||
    from === undefined ||
    to === undefined
  ) {
    return;
  }
  coverageState.ranges = mergeHistoryCoverageRanges({
    incomingRange: { from, to },
    intervalSeconds,
    ranges: coverageState.ranges,
  });
}

function applyHistoryGapRecoveryToPagination({
  coverageState,
  interval,
  intervalSeconds,
  pagination,
  recovery,
  seriesKey,
  timeTo,
}: {
  coverageState: IHistoryCoverageState;
  interval: ITradingViewNativeChartInterval;
  intervalSeconds: number;
  pagination: IHistoryPaginationState;
  recovery: IHistoryGapRecoveryResult;
  seriesKey: string;
  timeTo: number;
}) {
  pagination.earliestTimestamp = recovery.cursorTimestamp;
  pagination.hasMore = recovery.hasMoreBefore;
  addHistoryCoverageRange({
    coverageState,
    from: recovery.cursorTimestamp,
    interval,
    intervalSeconds,
    seriesKey,
    to: timeTo,
  });
}

function createHistoryGapRecoveryProgressHandler({
  coverageState,
  interval,
  intervalSeconds,
  isActive,
  onPoints,
  pagination,
  seriesKey,
  timeTo,
}: IHistoryGapRecoveryProgressOptions) {
  let appliedCursorTimestamp: number | undefined;
  return (recovery: IHistoryGapRecoveryResult) => {
    if (
      !isActive() ||
      recovery.historySource === 'fallback' ||
      appliedCursorTimestamp === recovery.cursorTimestamp
    ) {
      return;
    }
    appliedCursorTimestamp = recovery.cursorTimestamp;
    applyHistoryGapRecoveryToPagination({
      coverageState,
      interval,
      intervalSeconds,
      pagination,
      recovery,
      seriesKey,
      timeTo,
    });
    onPoints(recovery.points);
  };
}

function getVisibleHistoryGap({
  coverageRanges,
  endIndex,
  intervalSeconds,
  points,
  searchPaddingPointCount = HISTORY_GAP_SEARCH_PADDING_POINT_COUNT,
  startIndex,
}: {
  coverageRanges: IHistoryCoverageRange[];
  endIndex: number;
  intervalSeconds: number;
  points: IMarketTokenKLineDataPoint[];
  searchPaddingPointCount?: number;
  startIndex: number;
}) {
  const normalizedSearchPaddingPointCount = Math.max(
    Math.floor(searchPaddingPointCount),
    0,
  );
  const searchStartIndex = Math.max(
    Math.floor(startIndex) - normalizedSearchPaddingPointCount,
    0,
  );
  const searchEndIndex = Math.min(
    Math.ceil(endIndex) + normalizedSearchPaddingPointCount,
    points.length,
  );
  const visibleCenterIndex = Math.floor(
    (Math.max(Math.floor(startIndex), 0) +
      Math.max(Math.ceil(endIndex) - 1, 0)) /
      2,
  );
  const gapTolerance = Math.max(intervalSeconds * 2, 1);

  for (
    let pointIndex = searchStartIndex;
    pointIndex < searchEndIndex - 1;
    pointIndex += 1
  ) {
    const leftPoint = points[pointIndex];
    const rightPoint = points[pointIndex + 1];
    if (leftPoint && rightPoint && rightPoint.t - leftPoint.t > gapTolerance) {
      const coveringRange = coverageRanges.find(
        (range) => range.from <= leftPoint.t && range.to >= rightPoint.t,
      );
      if (!coveringRange) {
        const leftCoverageRange = coverageRanges.find(
          (range) => range.from <= leftPoint.t && range.to >= leftPoint.t,
        );
        const rightCoverageRange = coverageRanges.find(
          (range) => range.from <= rightPoint.t && range.to >= rightPoint.t,
        );
        const from = leftCoverageRange?.to ?? leftPoint.t;
        const to = rightCoverageRange?.from ?? rightPoint.t;
        if (to - from > gapTolerance) {
          return {
            from,
            loadFrom: visibleCenterIndex <= pointIndex ? 'left' : 'right',
            to,
          } as const;
        }
      }
    }
  }

  return null;
}

function getVisiblePointAnchorTimestamp({
  points,
  range,
}: {
  points: IMarketTokenKLineDataPoint[];
  range: IScopedVisiblePointRange;
}) {
  if (!points.length) {
    return undefined;
  }
  const startIndex = Math.min(
    Math.max(Math.floor(range.startIndex), 0),
    points.length - 1,
  );
  const endIndex = Math.min(
    Math.max(Math.ceil(range.endIndex) - 1, startIndex),
    points.length - 1,
  );
  return points[Math.floor((startIndex + endIndex) / 2)]?.t;
}

function getViewportTargetTimeRange(target: ITradingViewNativeViewportTarget) {
  if (target.kind === 'timestamp') {
    return Number.isFinite(target.timestamp)
      ? { from: target.timestamp, to: target.timestamp }
      : null;
  }
  if (!Number.isFinite(target.from) || !Number.isFinite(target.to)) {
    return null;
  }
  return {
    from: Math.min(target.from, target.to),
    to: Math.max(target.from, target.to),
  };
}

function getReachableViewportTarget({
  points,
  target,
}: {
  points: IMarketTokenKLineDataPoint[];
  target: ITradingViewNativeViewportTarget;
}): ITradingViewNativeViewportTarget {
  const targetTimeRange = getViewportTargetTimeRange(target);
  const earliestTimestamp = points[0]?.t;
  const latestTimestamp = points[points.length - 1]?.t;
  if (
    !targetTimeRange ||
    earliestTimestamp === undefined ||
    latestTimestamp === undefined
  ) {
    return target;
  }

  if (targetTimeRange.to < earliestTimestamp) {
    return {
      kind: 'timestamp',
      timestamp: earliestTimestamp,
    };
  }
  if (targetTimeRange.from > latestTimestamp) {
    return {
      kind: 'timestamp',
      timestamp: latestTimestamp,
    };
  }
  if (target.kind === 'timeRange') {
    return {
      kind: 'timeRange',
      from: Math.max(targetTimeRange.from, earliestTimestamp),
      to: Math.min(targetTimeRange.to, latestTimestamp),
    };
  }

  return {
    kind: 'timestamp',
    timestamp: Math.min(
      Math.max(target.timestamp, earliestTimestamp),
      latestTimestamp,
    ),
  };
}

function hasViewportTargetHistory({
  intervalSeconds,
  points,
  target,
}: {
  intervalSeconds: number;
  points: IMarketTokenKLineDataPoint[];
  target: ITradingViewNativeViewportTarget;
}) {
  const targetTimeRange = getViewportTargetTimeRange(target);
  if (!targetTimeRange || !points.length) {
    return false;
  }

  const getClosestTimestampDistance = (timestamp: number) => {
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const point of points) {
      const distance = Math.abs(point.t - timestamp);
      closestDistance = Math.min(closestDistance, distance);
      if (point.t > timestamp) {
        break;
      }
    }
    return closestDistance;
  };
  const tolerance = Math.max(intervalSeconds * 2, 1);
  return (
    getClosestTimestampDistance(targetTimeRange.from) <= tolerance &&
    getClosestTimestampDistance(targetTimeRange.to) <= tolerance
  );
}

function getViewportTargetForwardCandleCount(candleCount: number) {
  return Math.min(
    VIEWPORT_TARGET_FORWARD_CANDLE_COUNT,
    Math.ceil(Math.max(Math.floor(candleCount), 2) / 2),
  );
}

function getViewportHistoryRequestTimeRange({
  candleCount,
  intervalSeconds,
  target,
}: {
  candleCount: number;
  intervalSeconds: number;
  target: ITradingViewNativeViewportTarget;
}) {
  const targetTimeRange = getViewportTargetTimeRange(target);
  if (!targetTimeRange) {
    return null;
  }

  if (target.kind === 'timestamp') {
    const requestCandleCount = Math.max(Math.floor(candleCount), 2);
    const candlesAfter =
      getViewportTargetForwardCandleCount(requestCandleCount);
    const timeTo = Math.ceil(target.timestamp) + candlesAfter * intervalSeconds;
    const timeFrom = getHistoryTimeFrom({
      candleCount: requestCandleCount,
      intervalSeconds,
      timeTo,
    });
    return {
      timeFrom,
      timeTo: Math.max(timeTo, timeFrom + intervalSeconds),
    };
  }

  const timeFrom = Math.max(
    Math.floor(targetTimeRange.from) - intervalSeconds,
    0,
  );
  return {
    timeFrom,
    timeTo: Math.max(
      Math.ceil(targetTimeRange.to) + intervalSeconds,
      timeFrom + intervalSeconds,
    ),
  };
}

function getDataState({
  hasPoints,
  historyState,
  isVisible,
  providerIsReady,
  realtimeState,
  supportsRealtime,
}: {
  hasPoints: boolean;
  historyState: IHistoryState;
  isVisible: boolean;
  providerIsReady: boolean;
  realtimeState: IRealtimeState;
  supportsRealtime: boolean;
}): ITradingViewNativeDataState {
  const lastUpdatedAt = getLatestTimestamp(
    historyState.lastUpdatedAt,
    realtimeState.lastUpdatedAt,
  );
  const error = realtimeState.error ?? historyState.error;

  if (!providerIsReady) {
    return { status: 'idle' };
  }
  if (!hasPoints && historyState.status === 'loading') {
    return { status: 'loading', lastUpdatedAt };
  }
  if (historyState.status === 'error' || realtimeState.status === 'error') {
    return {
      status: hasPoints ? 'stale' : 'error',
      error,
      lastUpdatedAt,
    };
  }
  if (
    realtimeState.status === 'connecting' ||
    realtimeState.status === 'reconnecting'
  ) {
    return { status: 'reconnecting', lastUpdatedAt };
  }
  if (!hasPoints) {
    return { status: 'idle', lastUpdatedAt };
  }
  if (!supportsRealtime || !isVisible) {
    return { status: 'stale', lastUpdatedAt };
  }
  return {
    status: realtimeState.status === 'live' ? 'live' : 'reconnecting',
    lastUpdatedAt,
  };
}

export function useTradingViewNativeKLine({
  onRealtimePoint,
  source,
}: {
  onRealtimePoint?: (point: IMarketTokenKLineDataPoint) => void;
  source: ITradingViewNativeSource;
}) {
  const sourceKind = source.kind;
  const assetId = source.kind === 'asset' ? source.assetId : '';
  const stockId = source.kind === 'stock' ? source.stockId : '';
  const hyperliquidCoin = source.kind === 'hyperliquid' ? source.coin : '';
  const hyperliquidEnvironment =
    source.kind === 'hyperliquid' ? source.environment : 'mainnet';
  const marketFallbackCoinGeckoId =
    source.kind === 'market' ? source.fallbackCoinGeckoId : undefined;
  const marketIsNative =
    source.kind === 'market' ? Boolean(source.isNative) : false;
  const marketNetworkId = source.kind === 'market' ? source.networkId : '';
  const marketTokenAddress =
    source.kind === 'market' ? source.tokenAddress : '';
  const marketSymbol = source.kind === 'market' ? source.symbol : '';
  const marketHistorySymbol = marketTokenAddress.trim() ? '' : marketSymbol;
  const marketRealtime =
    source.kind === 'market' ? source.realtime : 'disabled';
  const rawHistoryProvider = useMemo(() => {
    if (sourceKind === 'asset') {
      return createTradingViewNativeDataProvider({
        kind: 'asset',
        assetId,
      });
    }
    if (sourceKind === 'hyperliquid') {
      return createTradingViewNativeDataProvider({
        kind: 'hyperliquid',
        coin: hyperliquidCoin,
        environment: hyperliquidEnvironment,
      });
    }
    if (sourceKind === 'stock') {
      return createTradingViewNativeDataProvider({
        kind: 'stock',
        stockId,
      });
    }
    return createTradingViewNativeDataProvider({
      kind: 'market',
      fallbackCoinGeckoId: marketFallbackCoinGeckoId,
      isNative: marketIsNative,
      networkId: marketNetworkId,
      tokenAddress: marketTokenAddress,
      symbol: marketHistorySymbol,
      realtime: 'disabled',
    });
  }, [
    assetId,
    hyperliquidCoin,
    hyperliquidEnvironment,
    marketFallbackCoinGeckoId,
    marketIsNative,
    marketHistorySymbol,
    marketNetworkId,
    marketTokenAddress,
    sourceKind,
    stockId,
  ]);
  const seriesKey = rawHistoryProvider.key;
  const [historyPointTypeScopeState, setHistoryPointTypeScopeState] = useState<{
    historyProvider: ITradingViewNativeDataProvider;
    scopes: ReadonlyMap<string, IHistoryPointTypeClassification>;
  }>(() => ({ historyProvider: rawHistoryProvider, scopes: new Map() }));
  const visibleHistoryPointTypeScopes =
    historyPointTypeScopeState.historyProvider === rawHistoryProvider
      ? historyPointTypeScopeState.scopes
      : undefined;
  const historyProvider = useMemo<ITradingViewNativeDataProvider>(() => {
    let selectedHistoryDataSource: IHistoryDataSource | undefined;
    const historyPointTypeScopes = new Map<
      string,
      IHistoryPointTypeClassification
    >();
    return {
      ...rawHistoryProvider,
      fetchHistory: async (request) => {
        historyDebugRequestSequence += 1;
        const debugRequestId = historyDebugRequestSequence;
        const startedAt = Date.now();
        emitTradingViewNativeDebugEvent({
          details: {
            interval: request.interval.value,
            providerKey: seriesKey,
            requestId: debugRequestId,
            timeFrom: request.timeFrom,
            timeTo: request.timeTo,
          },
          name: 'history.request',
        });
        try {
          const data = await rawHistoryProvider.fetchHistory(request);
          const responseDataSource: IHistoryDataSource =
            data?.historySource === 'fallback' ? 'fallback' : 'primary';
          const responseDetails = {
            durationMs: Date.now() - startedAt,
            historySource: responseDataSource,
            interval: request.interval.value,
            pointType: data?.pointType,
            points: data?.points.length ?? 0,
            providerKey: seriesKey,
            requestId: debugRequestId,
          };

          if (request.signal.aborted) {
            emitTradingViewNativeDebugEvent({
              details: responseDetails,
              level: 'warning',
              name: 'history.response.aborted',
            });
            return data;
          }

          if (
            data &&
            selectedHistoryDataSource &&
            selectedHistoryDataSource !== responseDataSource
          ) {
            emitTradingViewNativeDebugEvent({
              details: {
                ...responseDetails,
                reason: 'source-mismatch',
                selectedHistorySource: selectedHistoryDataSource,
              },
              level: 'warning',
              name: 'history.response.dropped',
            });
            return {
              ...data,
              historySource:
                selectedHistoryDataSource === 'fallback'
                  ? 'fallback'
                  : undefined,
              points: [],
              total: 0,
            };
          }

          if (data && data.points.length > 0) {
            selectedHistoryDataSource ??= responseDataSource;
            const scopeKey = getHistoryPointTypeScopeKey(
              seriesKey,
              request.interval.value,
            );
            const currentClassification = historyPointTypeScopes.get(scopeKey);
            const nextClassification = resolveHistoryPointTypeClassification({
              currentClassification,
              historySource: data.historySource,
              pointType: data.pointType,
            });
            if (nextClassification !== currentClassification) {
              historyPointTypeScopes.set(scopeKey, nextClassification);
              setHistoryPointTypeScopeState({
                historyProvider: rawHistoryProvider,
                scopes: new Map(historyPointTypeScopes),
              });
            }
          }

          emitTradingViewNativeDebugEvent({
            details: responseDetails,
            level: responseDataSource === 'fallback' ? 'warning' : 'info',
            name: 'history.response',
          });
          if (responseDataSource === 'fallback') {
            emitTradingViewNativeDebugEvent({
              details: {
                interval: request.interval.value,
                points: data?.points.length ?? 0,
                providerKey: seriesKey,
                requestId: debugRequestId,
              },
              level: 'warning',
              name: 'history.fallback.used',
            });
          }
          return data;
        } catch (error) {
          const wasAborted = request.signal.aborted || isAbortError(error);
          emitTradingViewNativeDebugEvent({
            details: {
              aborted: wasAborted,
              durationMs: Date.now() - startedAt,
              error: getTradingViewNativeDebugErrorMessage(error),
              interval: request.interval.value,
              providerKey: seriesKey,
              requestId: debugRequestId,
            },
            level: wasAborted ? 'warning' : 'error',
            name: wasAborted
              ? 'history.request.aborted'
              : 'history.request.error',
          });
          throw error;
        }
      },
    };
  }, [rawHistoryProvider, seriesKey]);
  const realtimeProvider = useMemo(() => {
    if (sourceKind === 'hyperliquid') {
      return historyProvider;
    }
    if (marketRealtime !== 'websocket') {
      return null;
    }

    return createTradingViewNativeDataProvider({
      kind: 'market',
      fallbackCoinGeckoId: marketFallbackCoinGeckoId,
      isNative: marketIsNative,
      networkId: marketNetworkId,
      tokenAddress: marketTokenAddress,
      symbol: marketSymbol,
      realtime: 'websocket',
    });
  }, [
    historyProvider,
    marketFallbackCoinGeckoId,
    marketIsNative,
    marketNetworkId,
    marketRealtime,
    marketSymbol,
    marketTokenAddress,
    sourceKind,
  ]);
  const providerIsReady = historyProvider.isReady;
  const historyRefreshInterval = historyProvider.historyRefreshInterval;
  const supportsRealtime = Boolean(
    realtimeProvider?.isReady && realtimeProvider.supportsRealtime,
  );
  const intervalStorageNamespace =
    getTradingViewNativeIntervalStorageNamespace(source);
  const currentSeriesKeyRef = useRef(seriesKey);
  currentSeriesKeyRef.current = seriesKey;
  const latestRequestIdRef = useRef(0);
  const viewportRequestIdRef = useRef(0);
  const initialHistoryAbortControllerRef = useRef<AbortController | null>(null);
  const viewportHistoryAbortControllerRef = useRef<AbortController | null>(
    null,
  );
  const viewportNavigationAnchorRef = useRef<IScopedViewportRequest | null>(
    null,
  );
  const onRealtimePointRef = useRef(onRealtimePoint);
  const skipNextRequestRef = useRef<{
    interval: ITradingViewNativeChartInterval;
    seriesKey: string;
  } | null>(null);
  const chartDataRef = useRef<IChartData | null>(null);
  const realtimeSubscriptionRef =
    useRef<ITradingViewNativeRealtimeSubscription | null>(null);
  const lastRealtimeActivityAtRef = useRef(Date.now());
  const [chartData, setChartData] = useState<IChartData | null>(null);
  const restoredActiveInterval = useMemo(
    () => readTradingViewNativeActiveInterval(intervalStorageNamespace),
    [intervalStorageNamespace],
  );
  const [activeIntervalState, setActiveIntervalState] =
    useState<IActiveIntervalState>(() => ({
      interval: restoredActiveInterval,
      namespace: intervalStorageNamespace,
    }));
  const activeInterval =
    activeIntervalState.namespace === intervalStorageNamespace
      ? activeIntervalState.interval
      : restoredActiveInterval;
  const setActiveInterval = useCallback(
    (
      nextInterval:
        | ITradingViewNativeChartInterval
        | ((
            currentInterval: ITradingViewNativeChartInterval,
          ) => ITradingViewNativeChartInterval),
    ) => {
      setActiveIntervalState((currentState) => {
        const currentInterval =
          currentState.namespace === intervalStorageNamespace
            ? currentState.interval
            : restoredActiveInterval;
        return {
          interval:
            typeof nextInterval === 'function'
              ? nextInterval(currentInterval)
              : nextInterval,
          namespace: intervalStorageNamespace,
        };
      });
    },
    [intervalStorageNamespace, restoredActiveInterval],
  );
  const [historyState, setHistoryState] = useState<IHistoryState>({
    interval: activeInterval,
    seriesKey,
    status: 'idle',
  });
  const [realtimeState, setRealtimeState] = useState<IRealtimeState>({
    interval: activeInterval,
    seriesKey,
    status: 'idle',
  });
  const [scopedViewportRequest, setScopedViewportRequest] =
    useState<IScopedViewportRequest | null>(null);
  const [
    historyBoundaryAvailableTimeRange,
    setHistoryBoundaryAvailableTimeRange,
  ] = useState<IHistoryBoundaryAvailableTimeRange | null>(null);
  const [isVisible, setIsVisible] = useState(() => getCurrentVisibilityState());
  const isVisibleRef = useRef(isVisible);
  const [historyRefreshRevision, setHistoryRefreshRevision] = useState(0);
  const [realtimeRetryRevision, setRealtimeRetryRevision] = useState(0);
  const [subscriberId] = useState(() => {
    realtimeSubscriberSequence += 1;
    return `trading-view-native-${realtimeSubscriberSequence}`;
  });
  const realtimePointBufferRef = useRef(
    new Map<number, IMarketTokenKLineDataPoint>(),
  );
  const realtimeScopeRef = useRef({ interval: activeInterval, seriesKey });
  const historyPaginationRef = useRef<IHistoryPaginationState>({
    hasMore: true,
    hasMoreAfter: false,
    interval: activeInterval,
    isLoading: false,
    seriesKey,
  });
  const historyCoverageRef = useRef<IHistoryCoverageState>({
    interval: activeInterval,
    ranges: [],
    seriesKey,
  });
  const visiblePointRangeRef = useRef<IScopedVisiblePointRange | null>(null);
  onRealtimePointRef.current = onRealtimePoint;
  chartDataRef.current = chartData;

  useEffect(() => {
    emitTradingViewNativeDebugEvent({
      details: {
        historyReady: providerIsReady,
        providerKey: seriesKey,
        sourceKind,
        supportsRealtime,
      },
      level: providerIsReady ? 'info' : 'warning',
      name: 'provider.configured',
    });
  }, [providerIsReady, seriesKey, sourceKind, supportsRealtime]);

  useEffect(() => {
    emitTradingViewNativeDebugEvent({
      details: {
        interval: activeInterval,
        namespace: intervalStorageNamespace,
        providerKey: seriesKey,
      },
      name: 'interval.active',
    });
  }, [activeInterval, intervalStorageNamespace, seriesKey]);

  useEffect(() => {
    setActiveIntervalState((currentState) =>
      currentState.namespace === intervalStorageNamespace
        ? currentState
        : {
            interval: restoredActiveInterval,
            namespace: intervalStorageNamespace,
          },
    );
  }, [intervalStorageNamespace, restoredActiveInterval]);

  useEffect(() => {
    const currentVisibility = getCurrentVisibilityState();
    emitTradingViewNativeDebugEvent({
      details: { visible: currentVisibility },
      name: 'visibility.initial',
    });
    isVisibleRef.current = currentVisibility;
    setIsVisible(currentVisibility);
    return onVisibilityStateChange((nextVisibility) => {
      const wasVisible = isVisibleRef.current;
      emitTradingViewNativeDebugEvent({
        details: { from: wasVisible, to: nextVisibility },
        name: 'visibility.changed',
      });
      isVisibleRef.current = nextVisibility;
      setIsVisible(nextVisibility);
      if (!wasVisible && nextVisibility) {
        setHistoryRefreshRevision((current) => current + 1);
      }
    });
  }, []);

  useEffect(() => {
    realtimeScopeRef.current = { interval: activeInterval, seriesKey };
    realtimePointBufferRef.current.clear();
    lastRealtimeActivityAtRef.current = Date.now();
  }, [activeInterval, seriesKey]);

  useEffect(() => {
    viewportHistoryAbortControllerRef.current?.abort();
    viewportHistoryAbortControllerRef.current = null;
    viewportNavigationAnchorRef.current = null;
    setScopedViewportRequest(null);
    historyPaginationRef.current.abortController?.abort();
    historyCoverageRef.current = {
      interval: activeInterval,
      ranges: [],
      seriesKey,
    };
    visiblePointRangeRef.current = null;
    const currentChartData = chartDataRef.current;
    historyPaginationRef.current = {
      earliestTimestamp:
        currentChartData?.seriesKey === seriesKey &&
        currentChartData.interval === activeInterval
          ? currentChartData.points[0]?.t
          : undefined,
      hasMore: true,
      hasMoreAfter: false,
      interval: activeInterval,
      isLoading: false,
      newerCursorTimestamp:
        currentChartData?.seriesKey === seriesKey &&
        currentChartData.interval === activeInterval
          ? currentChartData.points[currentChartData.points.length - 1]?.t
          : undefined,
      seriesKey,
    };

    return () => {
      const pagination = historyPaginationRef.current;
      if (
        pagination.seriesKey === seriesKey &&
        pagination.interval === activeInterval
      ) {
        pagination.abortController?.abort();
      }
      viewportHistoryAbortControllerRef.current?.abort();
    };
  }, [activeInterval, seriesKey]);

  const visibleChartData =
    chartData?.seriesKey === seriesKey ? chartData : null;
  const isSwitchingInterval = Boolean(
    visibleChartData && visibleChartData.interval !== activeInterval,
  );
  const displayedInterval =
    getTradingViewNativeKLineInterval(
      visibleChartData?.interval ?? activeInterval,
    ) ?? TRADING_VIEW_NATIVE_KLINE_INTERVALS[4];
  const intervalConfig = useMemo(
    () => ({
      intervals: TRADING_VIEW_NATIVE_KLINE_INTERVALS,
      activeInterval,
    }),
    [activeInterval],
  );

  useEffect(() => {
    if (
      activeIntervalState.namespace !== intervalStorageNamespace ||
      visibleChartData?.seriesKey !== seriesKey ||
      visibleChartData.interval !== activeInterval
    ) {
      return;
    }
    void saveTradingViewNativeActiveInterval({
      interval: activeInterval,
      namespace: intervalStorageNamespace,
    });
  }, [
    activeInterval,
    activeIntervalState.namespace,
    intervalStorageNamespace,
    seriesKey,
    visibleChartData?.interval,
    visibleChartData?.seriesKey,
  ]);

  const handleIntervalChange = useCallback(
    (
      interval: string,
      options?: {
        skipNextHistoryRequest?: boolean;
      },
    ) => {
      const nextInterval = getTradingViewNativeKLineInterval(interval);
      if (nextInterval) {
        viewportHistoryAbortControllerRef.current?.abort();
        viewportHistoryAbortControllerRef.current = null;
        setScopedViewportRequest(null);
        if (options?.skipNextHistoryRequest) {
          skipNextRequestRef.current = {
            interval: nextInterval.value,
            seriesKey,
          };
        }
        setActiveInterval(nextInterval.value);
      }
    },
    [seriesKey, setActiveInterval],
  );

  const handleRetry = useCallback(() => {
    emitTradingViewNativeDebugEvent({ name: 'data.retry.requested' });
    setHistoryRefreshRevision((current) => current + 1);
    setRealtimeRetryRevision((current) => current + 1);
  }, []);

  const handleViewportRequestApplied = useCallback((requestId: number) => {
    setScopedViewportRequest((currentRequest) => {
      if (currentRequest?.requestId !== requestId) {
        return currentRequest;
      }
      if (viewportNavigationAnchorRef.current?.requestId === requestId) {
        viewportNavigationAnchorRef.current = null;
      }
      return null;
    });
  }, []);

  const getVisibleTimeRange = useCallback(() => {
    const currentChartData = chartDataRef.current;
    const visibleRange = visiblePointRangeRef.current;
    if (
      !visibleRange ||
      currentChartData?.seriesKey !== seriesKey ||
      currentChartData.interval !== activeInterval ||
      !currentChartData.points.length
    ) {
      return undefined;
    }

    const firstIndex = Math.min(
      Math.max(Math.floor(visibleRange.startIndex), 0),
      currentChartData.points.length - 1,
    );
    const lastIndex = Math.min(
      Math.max(Math.ceil(visibleRange.endIndex) - 1, firstIndex),
      currentChartData.points.length - 1,
    );
    const from = currentChartData.points[firstIndex]?.t;
    const lastTimestamp = currentChartData.points[lastIndex]?.t;
    const interval = getTradingViewNativeKLineInterval(activeInterval);
    if (
      from === undefined ||
      lastTimestamp === undefined ||
      !interval ||
      lastTimestamp < from
    ) {
      return undefined;
    }

    return {
      from,
      to: lastTimestamp + interval.seconds,
    };
  }, [activeInterval, seriesKey]);

  const handleHistoryBoundaryPrefetch = useCallback(() => {
    if (!providerIsReady) {
      return;
    }
    const publishBoundaryTimestamp = (earliestTimestamp: number) => {
      setHistoryBoundaryAvailableTimeRange({
        from: earliestTimestamp,
        seriesKey,
      });
      const pagination = historyPaginationRef.current;
      if (
        pagination.seriesKey === seriesKey &&
        pagination.earliestTimestamp !== undefined
      ) {
        pagination.hasMore = pagination.earliestTimestamp > earliestTimestamp;
      }
    };
    const cacheKey = getHistoryBoundaryPrefetchCacheKey(seriesKey);
    const cachedEarliestTimestamp = getCachedHistoryBoundaryTimestamp(cacheKey);
    if (cachedEarliestTimestamp !== undefined) {
      publishBoundaryTimestamp(cachedEarliestTimestamp);
      return;
    }
    void prefetchHistoryBoundaryPage({
      historyProvider,
      seriesKey,
    }).then((page) => {
      if (!page || currentSeriesKeyRef.current !== seriesKey) {
        return;
      }
      if (page.hasMoreBefore || page.earliestTimestamp === undefined) {
        setHistoryBoundaryAvailableTimeRange((currentRange) =>
          currentRange?.seriesKey === seriesKey ? null : currentRange,
        );
        return;
      }
      publishBoundaryTimestamp(page.earliestTimestamp);
    });
  }, [historyProvider, providerIsReady, seriesKey]);

  const handleViewportTargetChange = useCallback(
    async (target: ITradingViewNativeViewportTarget) => {
      const interval =
        getTradingViewNativeKLineInterval(activeInterval) ??
        TRADING_VIEW_NATIVE_KLINE_INTERVALS[4];
      const requestTimeRange = getViewportHistoryRequestTimeRange({
        candleCount: historyProvider.getHistoryRequestCandleCount(interval),
        intervalSeconds: interval.seconds,
        target,
      });
      const targetTimeRange = getViewportTargetTimeRange(target);
      if (!requestTimeRange || !targetTimeRange) {
        return;
      }

      viewportRequestIdRef.current += 1;
      const requestId = viewportRequestIdRef.current;
      const nextViewportRequest: IScopedViewportRequest = {
        interval: activeInterval,
        requestId,
        seriesKey,
        target,
      };
      const exposeViewportRequest = (
        nextTarget: ITradingViewNativeViewportTarget,
      ) => {
        const request = {
          ...nextViewportRequest,
          target: nextTarget,
        };
        viewportNavigationAnchorRef.current = request;
        setScopedViewportRequest(request);
      };
      viewportHistoryAbortControllerRef.current?.abort();
      viewportHistoryAbortControllerRef.current = null;
      viewportNavigationAnchorRef.current = nextViewportRequest;
      setScopedViewportRequest(null);

      const currentChartData = chartDataRef.current;
      if (
        currentChartData?.seriesKey === seriesKey &&
        currentChartData.interval === activeInterval &&
        hasViewportTargetHistory({
          intervalSeconds: interval.seconds,
          points: currentChartData.points,
          target,
        })
      ) {
        exposeViewportRequest(target);
        return;
      }
      if (!providerIsReady) {
        exposeViewportRequest(
          getReachableViewportTarget({
            points:
              currentChartData?.seriesKey === seriesKey &&
              currentChartData.interval === activeInterval
                ? currentChartData.points
                : [],
            target,
          }),
        );
        return;
      }

      const initialHistoryAbortController =
        initialHistoryAbortControllerRef.current;
      if (initialHistoryAbortController) {
        initialHistoryAbortController.abort();
        initialHistoryAbortControllerRef.current = null;
        latestRequestIdRef.current += 1;
      }
      const pagination = historyPaginationRef.current;
      if (
        pagination.seriesKey === seriesKey &&
        pagination.interval === activeInterval
      ) {
        pagination.abortController?.abort();
        pagination.abortController = undefined;
        pagination.isLoading = false;
      }

      const abortController = new AbortController();
      viewportHistoryAbortControllerRef.current = abortController;
      try {
        const existingPoints =
          currentChartData?.seriesKey === seriesKey &&
          currentChartData.interval === activeInterval
            ? currentChartData.points
            : [];
        const existingEarliestPoint = existingPoints[0];
        const existingSeriesLatestPoint =
          currentChartData?.seriesKey === seriesKey
            ? currentChartData.points[currentChartData.points.length - 1]
            : undefined;
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const latestReachableTimestamp = Math.max(
          currentTimestamp,
          existingSeriesLatestPoint?.t ?? 0,
        );
        const shouldLoadLatestIntervalHistory =
          targetTimeRange.from > latestReachableTimestamp;
        const shouldMergeLatestIntervalState =
          targetTimeRange.to >= currentTimestamp;
        const canReuseExistingLatestState = !pagination.hasMoreAfter;
        let targetPoints: IMarketTokenKLineDataPoint[] = [];
        let nextRequestTimeRange = requestTimeRange;
        let hasMoreTargetHistory = false;
        let reachedHistoryBoundary = false;
        const latestIntervalHistoryTimeFrom = shouldMergeLatestIntervalState
          ? getHistoryTimeFrom({
              candleCount:
                historyProvider.getHistoryRequestCandleCount(interval),
              intervalSeconds: interval.seconds,
              timeTo: currentTimestamp,
            })
          : undefined;
        let realtimePointsIncludedInLatestHistory: IMarketTokenKLineDataPoint[] =
          [];

        if (shouldLoadLatestIntervalHistory) {
          const latestTimeTo = currentTimestamp;
          const latestTimeFrom =
            latestIntervalHistoryTimeFrom ??
            getHistoryTimeFrom({
              candleCount:
                historyProvider.getHistoryRequestCandleCount(interval),
              intervalSeconds: interval.seconds,
              timeTo: latestTimeTo,
            });
          const latestData = await fetchRequiredHistoryPage({
            historyProvider,
            request: {
              interval,
              signal: abortController.signal,
              timeFrom: latestTimeFrom,
              timeTo: latestTimeTo,
            },
            unavailableMessage:
              'No latest candle history response is available for time navigation',
          });
          if (
            abortController.signal.aborted ||
            viewportHistoryAbortControllerRef.current !== abortController
          ) {
            return;
          }
          const latestHistoryPoints = normalizeKLinePointsInRange({
            from: latestTimeFrom,
            points: latestData.points,
            to: latestTimeTo,
          });
          const latestChartData = chartDataRef.current;
          const latestChartPoints =
            canReuseExistingLatestState &&
            latestChartData?.seriesKey === seriesKey &&
            latestChartData.interval === activeInterval
              ? normalizeKLinePointsInRange({
                  from: latestTimeFrom,
                  points: latestChartData.points,
                  to: latestTimeTo,
                })
              : [];
          const realtimeScope = realtimeScopeRef.current;
          realtimePointsIncludedInLatestHistory =
            realtimeScope.seriesKey === seriesKey &&
            realtimeScope.interval === activeInterval
              ? normalizeKLinePointsInRange({
                  from: latestTimeFrom,
                  points: [...realtimePointBufferRef.current.values()],
                  to: latestTimeTo,
                })
              : [];
          const latestPoints = mergeKLinePoints(
            mergeKLinePoints(latestHistoryPoints, latestChartPoints),
            realtimePointsIncludedInLatestHistory,
          );
          targetPoints = mergeKLinePoints(targetPoints, latestPoints);
          hasMoreTargetHistory = historyProvider.hasMoreHistory({
            historySource: latestData.historySource,
            interval,
            receivedPointCount: latestHistoryPoints.length,
          });
          addHistoryCoverageRange({
            coverageState: historyCoverageRef.current,
            from: latestPoints[0]?.t,
            interval: activeInterval,
            intervalSeconds: interval.seconds,
            seriesKey,
            to: latestPoints[latestPoints.length - 1]?.t,
          });
        }

        let targetPageCount = 0;
        if (!shouldLoadLatestIntervalHistory) {
          targetPageCount =
            target.kind === 'timeRange' ? 1 : MAX_VIEWPORT_HISTORY_PAGE_COUNT;
        }
        for (let pageIndex = 0; pageIndex < targetPageCount; pageIndex += 1) {
          const data = await fetchRequiredHistoryPage({
            historyProvider,
            request: {
              interval,
              signal: abortController.signal,
              ...nextRequestTimeRange,
            },
            unavailableMessage:
              'No candle history response is available for time navigation',
          });
          if (
            abortController.signal.aborted ||
            viewportHistoryAbortControllerRef.current !== abortController
          ) {
            return;
          }

          const normalizedPagePoints = normalizeKLinePoints(data.points);
          addHistoryCoverageRange({
            coverageState: historyCoverageRef.current,
            from: normalizedPagePoints[0]?.t,
            interval: activeInterval,
            intervalSeconds: interval.seconds,
            seriesKey,
            to: normalizedPagePoints[normalizedPagePoints.length - 1]?.t,
          });
          const previousEarliestTimestamp = targetPoints[0]?.t;
          const pagePoints =
            previousEarliestTimestamp === undefined
              ? normalizedPagePoints
              : normalizedPagePoints.filter(
                  (point) => point.t < previousEarliestTimestamp,
                );
          if (!pagePoints.length) {
            hasMoreTargetHistory = false;
            break;
          }

          targetPoints = mergeKLinePoints(targetPoints, pagePoints);
          hasMoreTargetHistory = historyProvider.hasMoreHistory({
            historySource: data.historySource,
            interval,
            receivedPointCount: normalizedPagePoints.length,
          });
          const loadedPoints = mergeKLinePoints(existingPoints, targetPoints);
          if (
            hasViewportTargetHistory({
              intervalSeconds: interval.seconds,
              points: loadedPoints,
              target,
            })
          ) {
            break;
          }

          const earliestTimestamp = targetPoints[0]?.t;
          const targetTolerance = Math.max(interval.seconds * 2, 1);
          if (
            !hasMoreTargetHistory ||
            earliestTimestamp === undefined ||
            earliestTimestamp <= targetTimeRange.from - targetTolerance
          ) {
            break;
          }

          const timeTo = earliestTimestamp - 1;
          const timeFrom = getHistoryTimeFrom({
            candleCount: historyProvider.getHistoryRequestCandleCount(interval),
            intervalSeconds: interval.seconds,
            timeTo,
          });
          if (timeFrom >= timeTo) {
            hasMoreTargetHistory = false;
            break;
          }
          nextRequestTimeRange = { timeFrom, timeTo };
        }

        if (
          !shouldLoadLatestIntervalHistory &&
          target.kind === 'timeRange' &&
          !hasViewportTargetHistory({
            intervalSeconds: interval.seconds,
            points: mergeKLinePoints(existingPoints, targetPoints),
            target,
          })
        ) {
          const rangeStartRequestTimeRange = getViewportHistoryRequestTimeRange(
            {
              candleCount:
                historyProvider.getHistoryRequestCandleCount(interval),
              intervalSeconds: interval.seconds,
              target: {
                kind: 'timestamp',
                timestamp: targetTimeRange.from,
              },
            },
          );
          if (rangeStartRequestTimeRange) {
            const rangeStartData = await fetchRequiredHistoryPage({
              historyProvider,
              request: {
                interval,
                signal: abortController.signal,
                ...rangeStartRequestTimeRange,
              },
              unavailableMessage:
                'No candle history response is available for the time range start',
            });
            if (
              abortController.signal.aborted ||
              viewportHistoryAbortControllerRef.current !== abortController
            ) {
              return;
            }
            const rangeStartPoints = normalizeKLinePoints(
              rangeStartData.points,
            );
            targetPoints = mergeKLinePoints(targetPoints, rangeStartPoints);
            addHistoryCoverageRange({
              coverageState: historyCoverageRef.current,
              from: rangeStartPoints[0]?.t,
              interval: activeInterval,
              intervalSeconds: interval.seconds,
              seriesKey,
              to: rangeStartPoints[rangeStartPoints.length - 1]?.t,
            });
          }
        }

        const shouldResolveHistoryBoundary =
          !shouldLoadLatestIntervalHistory &&
          (!existingPoints.length ||
            (existingEarliestPoint !== undefined &&
              targetTimeRange.to < existingEarliestPoint.t));
        if (!targetPoints.length && shouldResolveHistoryBoundary) {
          const prefetchedCoarsestPage = await (getHistoryBoundaryPrefetchPage(
            seriesKey,
          ) ??
            prefetchHistoryBoundaryPage({
              historyProvider,
              seriesKey,
            }));
          if (
            abortController.signal.aborted ||
            viewportHistoryAbortControllerRef.current !== abortController
          ) {
            return;
          }
          const prefetchedEarliestTimestamp =
            prefetchedCoarsestPage?.hasMoreBefore === false
              ? prefetchedCoarsestPage.earliestTimestamp
              : undefined;
          const knownPoint =
            existingEarliestPoint ??
            existingSeriesLatestPoint ??
            prefetchedCoarsestPage?.points[
              prefetchedCoarsestPage.points.length - 1
            ];
          const isBeforePrefetchedBoundary =
            prefetchedEarliestTimestamp !== undefined &&
            targetTimeRange.to < prefetchedEarliestTimestamp;
          let boundaryHistory: Awaited<
            ReturnType<typeof findFirstHistoryPageAtOrAfter>
          > = null;
          if (knownPoint && targetTimeRange.to < knownPoint.t) {
            if (isBeforePrefetchedBoundary) {
              boundaryHistory = {
                historySource: undefined,
                points: [],
                timestamp: prefetchedEarliestTimestamp,
              };
            } else {
              boundaryHistory = await findFirstHistoryPageAtOrAfter({
                historyProvider,
                interval,
                knownPoint,
                prefetchedCoarsestPage,
                signal: abortController.signal,
                timeFrom: targetTimeRange.to,
              });
            }
          }
          if (
            abortController.signal.aborted ||
            viewportHistoryAbortControllerRef.current !== abortController
          ) {
            return;
          }
          if (!boundaryHistory) {
            throw new OneKeyLocalError(
              'No candle history boundary is available for time navigation',
            );
          }

          const timeFrom = Math.max(
            boundaryHistory.timestamp - interval.seconds,
            0,
          );
          const targetForwardCandleCount = getViewportTargetForwardCandleCount(
            historyProvider.getHistoryRequestCandleCount(interval),
          );
          const timeTo =
            boundaryHistory.timestamp +
            targetForwardCandleCount * interval.seconds;
          const data = await fetchRequiredHistoryPage({
            historyProvider,
            request: {
              interval,
              signal: abortController.signal,
              timeFrom,
              timeTo,
            },
            unavailableMessage:
              'No candle history response is available for boundary display',
          });
          if (
            abortController.signal.aborted ||
            viewportHistoryAbortControllerRef.current !== abortController
          ) {
            return;
          }

          const displayPoints = normalizeKLinePoints(data.points).filter(
            (point) =>
              point.t >= boundaryHistory.timestamp && point.t <= timeTo,
          );
          if (!displayPoints.length) {
            throw new OneKeyLocalError(
              'No candle history is available at the resolved boundary',
            );
          }
          targetPoints = displayPoints;
          hasMoreTargetHistory = false;
          reachedHistoryBoundary = isBeforePrefetchedBoundary;
          addHistoryCoverageRange({
            coverageState: historyCoverageRef.current,
            from: targetPoints[0]?.t,
            interval: activeInterval,
            intervalSeconds: interval.seconds,
            seriesKey,
            to: targetPoints[targetPoints.length - 1]?.t,
          });
        }

        if (target.kind === 'timestamp' && targetPoints.length) {
          const firstTargetTimestamp = targetPoints[0]?.t;
          const lastTargetTimestamp = targetPoints[targetPoints.length - 1]?.t;
          const latestKnownTimestamp =
            existingPoints[existingPoints.length - 1]?.t ??
            Math.floor(Date.now() / 1000);
          const targetForwardCandleCount = getViewportTargetForwardCandleCount(
            historyProvider.getHistoryRequestCandleCount(interval),
          );
          const forwardTimeTo =
            firstTargetTimestamp === undefined
              ? undefined
              : Math.min(
                  firstTargetTimestamp +
                    targetForwardCandleCount * interval.seconds,
                  latestKnownTimestamp,
                );
          if (
            lastTargetTimestamp !== undefined &&
            forwardTimeTo !== undefined &&
            lastTargetTimestamp < forwardTimeTo
          ) {
            const forwardTimeFrom = lastTargetTimestamp + 1;
            try {
              const forwardData = await historyProvider.fetchHistory({
                interval,
                signal: abortController.signal,
                timeFrom: forwardTimeFrom,
                timeTo: forwardTimeTo,
              });
              if (
                abortController.signal.aborted ||
                viewportHistoryAbortControllerRef.current !== abortController
              ) {
                return;
              }
              if (forwardData) {
                const forwardPoints = normalizeKLinePointsInRange({
                  from: forwardTimeFrom,
                  points: forwardData.points,
                  to: forwardTimeTo,
                });
                targetPoints = mergeKLinePoints(targetPoints, forwardPoints);
                addHistoryCoverageRange({
                  coverageState: historyCoverageRef.current,
                  from: forwardTimeFrom,
                  interval: activeInterval,
                  intervalSeconds: interval.seconds,
                  seriesKey,
                  to: forwardTimeTo,
                });
              }
            } catch (error) {
              if (
                abortController.signal.aborted ||
                isAbortError(error) ||
                viewportHistoryAbortControllerRef.current !== abortController
              ) {
                return;
              }
              logTradingViewNativeDataError(
                'Failed to extend native TradingView time navigation history',
                error,
              );
            }
          }
        }

        if (
          shouldMergeLatestIntervalState &&
          latestIntervalHistoryTimeFrom !== undefined
        ) {
          const latestMergeTimeTo = Math.floor(Date.now() / 1000);
          const latestChartData = chartDataRef.current;
          const latestChartPoints =
            canReuseExistingLatestState &&
            latestChartData?.seriesKey === seriesKey &&
            latestChartData.interval === activeInterval
              ? normalizeKLinePointsInRange({
                  from: latestIntervalHistoryTimeFrom,
                  points: latestChartData.points,
                  to: latestMergeTimeTo,
                })
              : [];
          const realtimeScope = realtimeScopeRef.current;
          const latestRealtimePoints =
            realtimeScope.seriesKey === seriesKey &&
            realtimeScope.interval === activeInterval
              ? normalizeKLinePointsInRange({
                  from: latestIntervalHistoryTimeFrom,
                  points: [...realtimePointBufferRef.current.values()],
                  to: latestMergeTimeTo,
                })
              : [];
          realtimePointsIncludedInLatestHistory = mergeKLinePoints(
            realtimePointsIncludedInLatestHistory,
            latestRealtimePoints,
          );
          targetPoints = mergeKLinePoints(
            mergeKLinePoints(targetPoints, latestChartPoints),
            latestRealtimePoints,
          );
          addHistoryCoverageRange({
            coverageState: historyCoverageRef.current,
            from: targetPoints[0]?.t,
            interval: activeInterval,
            intervalSeconds: interval.seconds,
            seriesKey,
            to: targetPoints[targetPoints.length - 1]?.t,
          });
        }

        const existingLatestTimestamp =
          existingPoints[existingPoints.length - 1]?.t;
        const hasRecentExistingPoint =
          canReuseExistingLatestState &&
          existingLatestTimestamp !== undefined &&
          latestIntervalHistoryTimeFrom !== undefined &&
          existingLatestTimestamp >= latestIntervalHistoryTimeFrom;
        if (
          shouldMergeLatestIntervalState &&
          !targetPoints.length &&
          !hasRecentExistingPoint
        ) {
          throw new OneKeyLocalError(
            'No recent candle history is available for current time navigation',
          );
        }

        if (targetPoints.length) {
          const previousEarliestTimestamp =
            currentChartData?.seriesKey === seriesKey &&
            currentChartData.interval === activeInterval
              ? currentChartData.points[0]?.t
              : undefined;
          if (
            pagination.seriesKey === seriesKey &&
            pagination.interval === activeInterval &&
            (previousEarliestTimestamp === undefined ||
              targetPoints[0].t < previousEarliestTimestamp)
          ) {
            pagination.earliestTimestamp = targetPoints[0].t;
            if (reachedHistoryBoundary) {
              pagination.hasMore = false;
            } else if (
              target.kind === 'timestamp' ||
              shouldLoadLatestIntervalHistory
            ) {
              pagination.hasMore = hasMoreTargetHistory;
            }
          }
          if (
            pagination.seriesKey === seriesKey &&
            pagination.interval === activeInterval
          ) {
            const latestTargetTimestamp =
              targetPoints[targetPoints.length - 1]?.t;
            if (
              latestTargetTimestamp !== undefined &&
              (pagination.newerCursorTimestamp === undefined ||
                latestTargetTimestamp >= pagination.newerCursorTimestamp)
            ) {
              pagination.newerCursorTimestamp = latestTargetTimestamp;
              pagination.hasMoreAfter =
                !shouldMergeLatestIntervalState &&
                latestTargetTimestamp + interval.seconds <
                  Math.floor(Date.now() / 1000);
            }
          }
          setChartData((currentData) => {
            if (currentData && currentData.seriesKey !== seriesKey) {
              return currentData;
            }
            const isCurrentInterval = currentData?.interval === activeInterval;
            return {
              chartPictureVersion: isCurrentInterval
                ? currentData.chartPictureVersion + 1
                : 0,
              interval: activeInterval,
              seriesKey,
              points: isCurrentInterval
                ? mergeKLinePoints(currentData.points, targetPoints)
                : targetPoints,
            };
          });
        }
        const navigationPoints = mergeKLinePoints(existingPoints, targetPoints);
        if (!navigationPoints.length) {
          throw new OneKeyLocalError(
            'No candle history is available for time navigation',
          );
        }
        setHistoryState({
          interval: activeInterval,
          lastUpdatedAt: Date.now(),
          seriesKey,
          status: 'ready',
        });
        exposeViewportRequest(
          getReachableViewportTarget({
            points: navigationPoints,
            target,
          }),
        );
        if (
          shouldMergeLatestIntervalState &&
          realtimeScopeRef.current.seriesKey === seriesKey &&
          realtimeScopeRef.current.interval === activeInterval
        ) {
          for (const point of realtimePointsIncludedInLatestHistory) {
            const bufferedPoint = realtimePointBufferRef.current.get(point.t);
            if (bufferedPoint && areKLinePointsEqual(bufferedPoint, point)) {
              realtimePointBufferRef.current.delete(point.t);
            }
          }
        }
      } catch (error) {
        if (abortController.signal.aborted || isAbortError(error)) {
          return;
        }
        logTradingViewNativeDataError(
          'Failed to fetch native TradingView history for time navigation',
          error,
        );
        viewportNavigationAnchorRef.current = null;
        setScopedViewportRequest(null);
        const latestChartData = chartDataRef.current;
        if (
          latestChartData?.seriesKey === seriesKey &&
          latestChartData.interval !== activeInterval
        ) {
          skipNextRequestRef.current = {
            interval: latestChartData.interval,
            seriesKey,
          };
          setHistoryState({
            interval: latestChartData.interval,
            lastUpdatedAt: Date.now(),
            seriesKey,
            status: 'ready',
          });
          setActiveInterval(latestChartData.interval);
        } else {
          setHistoryState({
            error,
            interval: activeInterval,
            seriesKey,
            status: 'error',
          });
        }
      } finally {
        if (viewportHistoryAbortControllerRef.current === abortController) {
          viewportHistoryAbortControllerRef.current = null;
        }
      }
    },
    [
      activeInterval,
      historyProvider,
      providerIsReady,
      seriesKey,
      setActiveInterval,
    ],
  );

  const handleVisiblePointRangeChange = useCallback(
    ({ endIndex, startIndex }: { endIndex?: number; startIndex: number }) => {
      const pagination = historyPaginationRef.current;
      const currentChartData = chartDataRef.current;
      if (
        pagination.seriesKey !== seriesKey ||
        pagination.interval !== activeInterval ||
        currentChartData?.seriesKey !== seriesKey ||
        currentChartData.interval !== activeInterval
      ) {
        return;
      }

      if (endIndex !== undefined && Number.isFinite(endIndex)) {
        visiblePointRangeRef.current = {
          endIndex,
          interval: activeInterval,
          seriesKey,
          startIndex,
        };
      }
      if (pagination.isLoading) {
        return;
      }

      const interval =
        getTradingViewNativeKLineInterval(activeInterval) ??
        TRADING_VIEW_NATIVE_KLINE_INTERVALS[4];
      const coverageState = historyCoverageRef.current;
      const navigationAnchor = viewportNavigationAnchorRef.current;
      const activeNavigationAnchor =
        endIndex !== undefined &&
        navigationAnchor?.seriesKey === seriesKey &&
        navigationAnchor.interval === activeInterval
          ? navigationAnchor
          : null;
      if (activeNavigationAnchor) {
        return;
      }
      const visibleGap =
        endIndex !== undefined &&
        coverageState.seriesKey === seriesKey &&
        coverageState.interval === activeInterval
          ? getVisibleHistoryGap({
              coverageRanges: coverageState.ranges,
              endIndex,
              intervalSeconds: interval.seconds,
              points: currentChartData.points,
              startIndex,
            })
          : null;
      if (visibleGap) {
        const loadGapFrom = visibleGap.loadFrom;
        const gapTimeFrom = Math.max(Math.floor(visibleGap.from) + 1, 0);
        const gapTimeTo = Math.ceil(visibleGap.to) - 1;
        const requestTimeSpan =
          HISTORY_GAP_REQUEST_CANDLE_COUNT * interval.seconds;
        const timeFrom =
          loadGapFrom === 'left'
            ? gapTimeFrom
            : Math.max(gapTimeFrom, Math.ceil(visibleGap.to) - requestTimeSpan);
        const timeTo =
          loadGapFrom === 'left'
            ? Math.min(gapTimeTo, Math.floor(visibleGap.from) + requestTimeSpan)
            : gapTimeTo;
        if (timeFrom >= timeTo) {
          addHistoryCoverageRange({
            coverageState,
            from: visibleGap.from,
            interval: activeInterval,
            intervalSeconds: interval.seconds,
            seriesKey,
            to: visibleGap.to,
          });
          return;
        }

        const abortController = new AbortController();
        pagination.abortController = abortController;
        pagination.isLoading = true;

        const loadHistoryGap = async () => {
          let nextTimeFrom = timeFrom;
          let nextTimeTo = timeTo;
          try {
            for (
              let pageIndex = 0;
              pageIndex < HISTORY_GAP_EMPTY_SCAN_PAGE_COUNT;
              pageIndex += 1
            ) {
              const data = await fetchRequiredHistoryPage({
                historyProvider,
                request: {
                  interval,
                  signal: abortController.signal,
                  timeFrom: nextTimeFrom,
                  timeTo: nextTimeTo,
                },
                unavailableMessage:
                  'No candle history response is available for the visible gap',
              });
              if (
                abortController.signal.aborted ||
                historyPaginationRef.current !== pagination
              ) {
                return;
              }

              const gapPoints = normalizeKLinePointsInRange({
                from: nextTimeFrom,
                points: data.points,
                to: nextTimeTo,
              }).filter(
                (point) => point.t > visibleGap.from && point.t < visibleGap.to,
              );
              addHistoryCoverageRange({
                coverageState: historyCoverageRef.current,
                from: nextTimeFrom,
                interval: activeInterval,
                intervalSeconds: interval.seconds,
                seriesKey,
                to: nextTimeTo,
              });
              if (gapPoints.length) {
                const latestChartData = chartDataRef.current;
                const latestVisibleRange = visiblePointRangeRef.current;
                const anchorTimestamp =
                  latestChartData?.seriesKey === seriesKey &&
                  latestChartData.interval === activeInterval &&
                  latestVisibleRange?.seriesKey === seriesKey &&
                  latestVisibleRange.interval === activeInterval
                    ? getVisiblePointAnchorTimestamp({
                        points: latestChartData.points,
                        range: latestVisibleRange,
                      })
                    : undefined;
                setChartData((currentData) => {
                  if (
                    currentData?.seriesKey !== seriesKey ||
                    currentData.interval !== activeInterval
                  ) {
                    return currentData;
                  }
                  return {
                    ...currentData,
                    chartPictureVersion: currentData.chartPictureVersion + 1,
                    points: mergeKLinePoints(currentData.points, gapPoints),
                  };
                });
                if (anchorTimestamp !== undefined) {
                  viewportRequestIdRef.current += 1;
                  const nextViewportRequest = {
                    interval: activeInterval,
                    preserveVisibleAnchor: true,
                    requestId: viewportRequestIdRef.current,
                    seriesKey,
                    target: {
                      kind: 'timestamp' as const,
                      timestamp: anchorTimestamp,
                    },
                  };
                  viewportNavigationAnchorRef.current = nextViewportRequest;
                  setScopedViewportRequest(nextViewportRequest);
                }
                return;
              }

              if (loadGapFrom === 'left') {
                if (nextTimeTo >= gapTimeTo) {
                  return;
                }
                nextTimeFrom = nextTimeTo + 1;
                nextTimeTo = Math.min(gapTimeTo, nextTimeTo + requestTimeSpan);
              } else {
                if (nextTimeFrom <= gapTimeFrom) {
                  return;
                }
                nextTimeTo = nextTimeFrom - 1;
                nextTimeFrom = Math.max(
                  gapTimeFrom,
                  nextTimeFrom - requestTimeSpan,
                );
              }
              if (nextTimeFrom >= nextTimeTo) {
                return;
              }
            }
          } catch (error) {
            if (abortController.signal.aborted || isAbortError(error)) {
              return;
            }
            logTradingViewNativeDataError(
              'Failed to fill a native TradingView candle history gap',
              error,
            );
          } finally {
            if (
              historyPaginationRef.current === pagination &&
              pagination.abortController === abortController
            ) {
              pagination.abortController = undefined;
              pagination.isLoading = false;
            }
          }
        };
        void loadHistoryGap();
        return;
      }

      const isNearNewerBoundary =
        endIndex !== undefined &&
        Number.isFinite(endIndex) &&
        endIndex >=
          currentChartData.points.length - HISTORY_NEWER_LOAD_MORE_THRESHOLD;
      if (isNearNewerBoundary && pagination.hasMoreAfter) {
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const newerCursorTimestamp =
          pagination.newerCursorTimestamp ??
          currentChartData.points[currentChartData.points.length - 1]?.t;
        if (
          newerCursorTimestamp === undefined ||
          !Number.isFinite(newerCursorTimestamp) ||
          newerCursorTimestamp >= currentTimestamp
        ) {
          pagination.hasMoreAfter = false;
          return;
        }

        const timeFrom = newerCursorTimestamp + 1;
        const timeTo = Math.min(
          newerCursorTimestamp +
            HISTORY_GAP_REQUEST_CANDLE_COUNT * interval.seconds,
          currentTimestamp,
        );
        if (timeFrom > timeTo) {
          pagination.hasMoreAfter = false;
          return;
        }

        const abortController = new AbortController();
        pagination.abortController = abortController;
        pagination.isLoading = true;

        const loadNewerHistory = async () => {
          try {
            const data = await fetchRequiredHistoryPage({
              historyProvider,
              request: {
                interval,
                signal: abortController.signal,
                timeFrom,
                timeTo,
              },
              unavailableMessage:
                'No newer candle history response is available',
            });
            if (
              abortController.signal.aborted ||
              historyPaginationRef.current !== pagination
            ) {
              return;
            }

            let newerPoints = normalizeKLinePointsInRange({
              from: timeFrom,
              points: data.points,
              to: timeTo,
            }).filter((point) => point.t > newerCursorTimestamp);
            addHistoryCoverageRange({
              coverageState: historyCoverageRef.current,
              from: timeFrom,
              interval: activeInterval,
              intervalSeconds: interval.seconds,
              seriesKey,
              to: timeTo,
            });
            let resolvedCursorTimestamp = timeTo;
            if (!newerPoints.length && timeTo < currentTimestamp) {
              // A chart clamped at the right edge may not emit another visible
              // range update. Probe broadly, then binary-search the first
              // available candle instead of walking every empty window.
              const scanTimeFrom = timeTo + 1;
              const scanData = await fetchRequiredHistoryPage({
                historyProvider,
                request: {
                  interval,
                  signal: abortController.signal,
                  timeFrom: scanTimeFrom,
                  timeTo: currentTimestamp,
                },
                unavailableMessage:
                  'No forward candle history response is available',
              });
              if (
                abortController.signal.aborted ||
                historyPaginationRef.current !== pagination
              ) {
                return;
              }

              const scanPoints = normalizeKLinePointsInRange({
                from: scanTimeFrom,
                points: scanData.points,
                to: currentTimestamp,
              });
              const knownPoint = scanPoints[0];
              if (knownPoint) {
                const firstAvailableHistory =
                  await findFirstHistoryPageAtOrAfterByBinarySearch({
                    historyProvider,
                    interval,
                    knownPoint,
                    signal: abortController.signal,
                    timeFrom: scanTimeFrom,
                  });
                if (
                  abortController.signal.aborted ||
                  historyPaginationRef.current !== pagination
                ) {
                  return;
                }
                newerPoints = normalizeKLinePoints(
                  firstAvailableHistory?.points ?? [knownPoint],
                ).filter((point) => point.t >= scanTimeFrom);
                resolvedCursorTimestamp =
                  newerPoints[newerPoints.length - 1]?.t ?? knownPoint.t;
                addHistoryCoverageRange({
                  coverageState: historyCoverageRef.current,
                  from: timeFrom,
                  interval: activeInterval,
                  intervalSeconds: interval.seconds,
                  seriesKey,
                  to: resolvedCursorTimestamp,
                });
              } else {
                resolvedCursorTimestamp = currentTimestamp;
                addHistoryCoverageRange({
                  coverageState: historyCoverageRef.current,
                  from: timeFrom,
                  interval: activeInterval,
                  intervalSeconds: interval.seconds,
                  seriesKey,
                  to: currentTimestamp,
                });
              }
            }
            pagination.newerCursorTimestamp = resolvedCursorTimestamp;
            pagination.hasMoreAfter =
              resolvedCursorTimestamp < currentTimestamp;

            let pointsToMerge = newerPoints;
            if (
              !pagination.hasMoreAfter &&
              realtimePointBufferRef.current.size > 0
            ) {
              pointsToMerge = mergeKLinePoints(
                pointsToMerge,
                realtimePointBufferRef.current.values(),
              );
              realtimePointBufferRef.current.clear();
            }
            if (!pointsToMerge.length) {
              return;
            }
            const latestChartData = chartDataRef.current;
            const latestVisibleRange = visiblePointRangeRef.current;
            const anchorTimestamp =
              latestChartData?.seriesKey === seriesKey &&
              latestChartData.interval === activeInterval &&
              latestVisibleRange?.seriesKey === seriesKey &&
              latestVisibleRange.interval === activeInterval
                ? getVisiblePointAnchorTimestamp({
                    points: latestChartData.points,
                    range: latestVisibleRange,
                  })
                : undefined;
            setChartData((currentData) => {
              if (
                currentData?.seriesKey !== seriesKey ||
                currentData.interval !== activeInterval
              ) {
                return currentData;
              }
              return {
                ...currentData,
                chartPictureVersion: currentData.chartPictureVersion + 1,
                points: mergeKLinePoints(currentData.points, pointsToMerge),
              };
            });
            if (anchorTimestamp !== undefined) {
              viewportRequestIdRef.current += 1;
              const nextViewportRequest = {
                interval: activeInterval,
                preserveVisibleAnchor: true,
                requestId: viewportRequestIdRef.current,
                seriesKey,
                target: {
                  kind: 'timestamp' as const,
                  timestamp: anchorTimestamp,
                },
              };
              viewportNavigationAnchorRef.current = nextViewportRequest;
              setScopedViewportRequest(nextViewportRequest);
            }
          } catch (error) {
            if (abortController.signal.aborted || isAbortError(error)) {
              return;
            }
            logTradingViewNativeDataError(
              'Failed to fetch newer native TradingView candle history',
              error,
            );
          } finally {
            if (
              historyPaginationRef.current === pagination &&
              pagination.abortController === abortController
            ) {
              pagination.abortController = undefined;
              pagination.isLoading = false;
            }
          }
        };
        void loadNewerHistory();
        return;
      }

      if (!pagination.hasMore) {
        return;
      }
      const olderHistoryPreloadPointCount = getOlderHistoryPreloadPointCount({
        endIndex,
        startIndex,
      });
      if (!olderHistoryPreloadPointCount) {
        return;
      }

      const earliestTimestamp =
        pagination.earliestTimestamp ?? currentChartData.points[0]?.t;
      if (
        earliestTimestamp === undefined ||
        !Number.isFinite(earliestTimestamp) ||
        earliestTimestamp <= 0
      ) {
        pagination.hasMore = false;
        return;
      }

      const timeTo = earliestTimestamp - 1;
      const isMarketMinuteHistory =
        sourceKind === 'market' &&
        (interval.value === '1' || interval.value === '5');
      const timeFrom = getHistoryTimeFrom({
        candleCount: isMarketMinuteHistory
          ? olderHistoryPreloadPointCount
          : historyProvider.getHistoryRequestCandleCount(interval),
        intervalSeconds: interval.seconds,
        timeTo,
      });
      if (timeFrom >= timeTo) {
        pagination.hasMore = false;
        return;
      }

      const abortController = new AbortController();
      pagination.abortController = abortController;
      pagination.isLoading = true;

      const loadOlderHistory = async () => {
        const requestAttemptBudget = createSparseHistoryRequestAttemptBudget();
        try {
          const data = await fetchRequiredHistoryPage({
            historyProvider,
            request: {
              interval,
              signal: abortController.signal,
              timeFrom,
              timeTo,
            },
            requestAttemptBudget,
            unavailableMessage: 'No older candle history response is available',
          });
          if (
            abortController.signal.aborted ||
            historyPaginationRef.current !== pagination
          ) {
            return;
          }

          const historySource = data.historySource;
          const receivedOlderPoints = normalizeKLinePoints(data.points).filter(
            (point) => point.t < earliestTimestamp,
          );
          let olderPoints = receivedOlderPoints;
          let paginationCursorTimestamp = olderPoints[0]?.t;
          const pageHasMoreHistory = historyProvider.hasMoreHistory({
            historySource,
            interval,
            receivedPointCount: receivedOlderPoints.length,
          });
          let hasMoreHistory = getHasPotentialEarlierHistory({
            earliestTimestamp: olderPoints[0]?.t,
            historyBoundaryTimestamp: getCachedHistoryBoundaryTimestamp(
              getHistoryBoundaryPrefetchCacheKey(seriesKey),
            ),
            historySource,
            pageHasMoreHistory,
            sourceKind,
          });
          const shouldRecoverSparseHistory =
            sourceKind === 'market' &&
            historySource !== 'fallback' &&
            (interval.value === '1' || interval.value === '5') &&
            !pageHasMoreHistory &&
            olderPoints.length < olderHistoryPreloadPointCount;
          const publishOlderPoints = (
            pointsToPublish: IMarketTokenKLineDataPoint[],
          ) => {
            setChartData((currentData) =>
              mergeScopedChartDataPoints({
                currentData,
                interval: activeInterval,
                points: pointsToPublish,
                seriesKey,
              }),
            );
          };

          if (!olderPoints.length || shouldRecoverSparseHistory) {
            addHistoryCoverageRange({
              coverageState: historyCoverageRef.current,
              from: timeFrom,
              interval: activeInterval,
              intervalSeconds: interval.seconds,
              seriesKey,
              to: timeTo,
            });
            if (!shouldRecoverSparseHistory) {
              pagination.hasMore = false;
              return;
            }
          }

          if (shouldRecoverSparseHistory) {
            publishOlderPoints(olderPoints);
            const recoveryTimeTo = Math.max(timeFrom - 1, 0);
            const recoveryTargetPointCount = Math.max(
              olderHistoryPreloadPointCount - olderPoints.length,
              1,
            );
            const applyRecoveryProgress =
              createHistoryGapRecoveryProgressHandler({
                coverageState: historyCoverageRef.current,
                interval: activeInterval,
                intervalSeconds: interval.seconds,
                isActive: () =>
                  !abortController.signal.aborted &&
                  historyPaginationRef.current === pagination,
                onPoints: publishOlderPoints,
                pagination,
                seriesKey,
                timeTo,
              });
            const recovery = await recoverOlderHistoryFromBoundary({
              historyProvider,
              initialConsecutiveEmptyWindowCount: olderPoints.length ? 0 : 1,
              interval,
              onProgress: applyRecoveryProgress,
              requestAttemptBudget,
              seriesKey,
              signal: abortController.signal,
              targetPointCount: recoveryTargetPointCount,
              timeTo: recoveryTimeTo,
            });
            if (
              abortController.signal.aborted ||
              historyPaginationRef.current !== pagination
            ) {
              return;
            }
            if (!recovery) {
              if (!olderPoints.length) {
                return;
              }
            } else {
              setHistoryBoundaryAvailableTimeRange({
                from: recovery.boundaryTimestamp,
                seriesKey,
              });
              if (recovery.historySource === 'fallback') {
                pagination.hasMore = false;
                if (!olderPoints.length) {
                  return;
                }
                hasMoreHistory = false;
              } else {
                olderPoints = mergeKLinePoints(recovery.points, olderPoints);
                paginationCursorTimestamp = recovery.cursorTimestamp;
                hasMoreHistory = recovery.hasMoreBefore;
                applyRecoveryProgress(recovery);
              }
              if (!olderPoints.length) {
                pagination.earliestTimestamp = recovery.cursorTimestamp;
                pagination.hasMore = recovery.hasMoreBefore;
                return;
              }
            }
          }

          addHistoryCoverageRange({
            coverageState: historyCoverageRef.current,
            from: olderPoints[0]?.t,
            interval: activeInterval,
            intervalSeconds: interval.seconds,
            seriesKey,
            to: olderPoints[olderPoints.length - 1]?.t,
          });
          pagination.earliestTimestamp =
            paginationCursorTimestamp ?? olderPoints[0].t;
          pagination.hasMore = hasMoreHistory;
          publishOlderPoints(olderPoints);
        } catch (error) {
          if (abortController.signal.aborted || isAbortError(error)) {
            return;
          }
          logTradingViewNativeDataError(
            'Failed to fetch older native TradingView candle history',
            error,
          );
        } finally {
          if (
            historyPaginationRef.current === pagination &&
            pagination.abortController === abortController
          ) {
            pagination.abortController = undefined;
            pagination.isLoading = false;
          }
        }
      };
      void loadOlderHistory();
    },
    [activeInterval, historyProvider, seriesKey, sourceKind],
  );

  const handleRealtimePoint = useCallback(
    (point: IMarketTokenKLineDataPoint) => {
      const realtimeScope = realtimeScopeRef.current;
      if (
        realtimeScope.seriesKey !== seriesKey ||
        realtimeScope.interval !== activeInterval
      ) {
        emitTradingViewNativeDebugEvent({
          details: {
            activeInterval,
            activeProviderKey: seriesKey,
            pointTimestamp: point.t,
            scopeInterval: realtimeScope.interval,
            scopeProviderKey: realtimeScope.seriesKey,
          },
          level: 'warning',
          name: 'realtime.point.ignored',
        });
        return;
      }

      const currentChartData = chartDataRef.current;
      if (
        !currentChartData ||
        currentChartData.seriesKey !== seriesKey ||
        currentChartData.interval !== activeInterval ||
        !currentChartData.points.length
      ) {
        lastRealtimeActivityAtRef.current = Date.now();
        emitTradingViewNativeDebugEvent({
          details: {
            activeInterval,
            activeProviderKey: seriesKey,
            pointTimestamp: point.t,
            reason: 'history-not-ready',
          },
          level: 'warning',
          name: 'realtime.point.ignored',
        });
        return;
      }

      emitTradingViewNativeDebugEvent({
        details: {
          close: point.c,
          interval: activeInterval,
          providerKey: seriesKey,
          timestamp: point.t,
          volume: point.v,
        },
        name: 'realtime.point',
      });
      const interval =
        getTradingViewNativeKLineInterval(activeInterval) ??
        TRADING_VIEW_NATIVE_KLINE_INTERVALS[4];
      addHistoryCoverageRange({
        coverageState: historyCoverageRef.current,
        from: point.t,
        interval: activeInterval,
        intervalSeconds: interval.seconds,
        seriesKey,
        to: point.t,
      });
      onRealtimePointRef.current?.(point);
      const updatedAt = Date.now();
      lastRealtimeActivityAtRef.current = updatedAt;
      setRealtimeState({
        interval: activeInterval,
        lastUpdatedAt: updatedAt,
        seriesKey,
        status: 'live',
      });
      bufferRealtimePoint(realtimePointBufferRef.current, point);
      const pagination = historyPaginationRef.current;
      if (
        pagination.seriesKey === seriesKey &&
        pagination.interval === activeInterval &&
        pagination.hasMoreAfter
      ) {
        return;
      }
      setChartData((currentData) => {
        if (
          !currentData ||
          currentData.seriesKey !== seriesKey ||
          currentData.interval !== activeInterval ||
          !currentData.points.length
        ) {
          return currentData;
        }

        const mergeResult = mergeRealtimePoint(currentData.points, point);
        return mergeResult.points === currentData.points
          ? currentData
          : {
              ...currentData,
              chartPictureVersion:
                currentData.chartPictureVersion +
                (mergeResult.didChangeHistoricalPoints ? 1 : 0),
              points: mergeResult.points,
            };
      });
    },
    [activeInterval, seriesKey],
  );

  useEffect(() => {
    if (!realtimeProvider || !supportsRealtime || !isVisible) {
      emitTradingViewNativeDebugEvent({
        details: {
          providerAvailable: Boolean(realtimeProvider),
          providerKey: seriesKey,
          supportsRealtime,
          visible: isVisible,
        },
        level: supportsRealtime && !isVisible ? 'warning' : 'info',
        name: 'realtime.subscription.skipped',
      });
      realtimeSubscriptionRef.current = null;
      setRealtimeState((current) => ({
        interval: activeInterval,
        lastUpdatedAt:
          current.seriesKey === seriesKey ? current.lastUpdatedAt : undefined,
        seriesKey,
        status: 'idle',
      }));
      return;
    }

    let isCancelled = false;
    const abortController = new AbortController();
    let ownedSubscription: ITradingViewNativeRealtimeSubscription | null = null;
    const hasCurrentPoints = Boolean(
      chartDataRef.current?.seriesKey === seriesKey &&
      chartDataRef.current.points.length,
    );
    emitTradingViewNativeDebugEvent({
      details: {
        hasCurrentPoints,
        interval: activeInterval,
        providerKey: seriesKey,
        subscriberId,
      },
      name: 'realtime.subscription.start',
    });
    setRealtimeState((current) => ({
      interval: activeInterval,
      lastUpdatedAt:
        current.seriesKey === seriesKey ? current.lastUpdatedAt : undefined,
      seriesKey,
      status: hasCurrentPoints ? 'reconnecting' : 'connecting',
    }));

    const subscribe = async () => {
      try {
        const nextSubscription = await realtimeProvider.subscribeRealtime({
          interval:
            getTradingViewNativeKLineInterval(activeInterval) ??
            TRADING_VIEW_NATIVE_KLINE_INTERVALS[4],
          onPoint: handleRealtimePoint,
          signal: abortController.signal,
          subscriberId,
        });
        if (isCancelled) {
          await nextSubscription?.unsubscribe();
          return;
        }

        ownedSubscription = nextSubscription;
        realtimeSubscriptionRef.current = nextSubscription;
        emitTradingViewNativeDebugEvent({
          details: {
            interval: activeInterval,
            providerKey: seriesKey,
            subscribed: Boolean(nextSubscription),
            subscriberId,
          },
          level: nextSubscription ? 'info' : 'warning',
          name: 'realtime.subscription.ready',
        });
        setRealtimeState((current) => {
          return {
            interval: activeInterval,
            lastUpdatedAt:
              current.seriesKey === seriesKey
                ? current.lastUpdatedAt
                : undefined,
            seriesKey,
            status: nextSubscription ? 'live' : 'idle',
          };
        });
        lastRealtimeActivityAtRef.current = Date.now();
      } catch (error) {
        if (isCancelled) {
          return;
        }
        logTradingViewNativeDataError(
          'Failed to subscribe to native TradingView realtime data',
          error,
        );
        emitTradingViewNativeDebugEvent({
          details: {
            error: getTradingViewNativeDebugErrorMessage(error),
            interval: activeInterval,
            providerKey: seriesKey,
            subscriberId,
          },
          level: 'error',
          name: 'realtime.subscription.error',
        });
        setRealtimeState((current) => ({
          error,
          interval: activeInterval,
          lastUpdatedAt:
            current.seriesKey === seriesKey ? current.lastUpdatedAt : undefined,
          seriesKey,
          status: 'error',
        }));
      }
    };
    void subscribe();

    return () => {
      isCancelled = true;
      abortController.abort();
      emitTradingViewNativeDebugEvent({
        details: {
          hadSubscription: Boolean(ownedSubscription),
          interval: activeInterval,
          providerKey: seriesKey,
          subscriberId,
        },
        name: 'realtime.subscription.dispose',
      });
      if (realtimeSubscriptionRef.current === ownedSubscription) {
        realtimeSubscriptionRef.current = null;
      }
      if (ownedSubscription) {
        void ownedSubscription.unsubscribe().catch((error: unknown) => {
          logTradingViewNativeDataError(
            'Failed to unsubscribe from native TradingView realtime data',
            error,
          );
        });
      }
    };
  }, [
    activeInterval,
    handleRealtimePoint,
    isVisible,
    realtimeProvider,
    realtimeRetryRevision,
    seriesKey,
    subscriberId,
    supportsRealtime,
  ]);

  useInterval(
    () => {
      emitTradingViewNativeDebugEvent({
        details: { providerKey: seriesKey },
        name: 'history.poll.requested',
      });
      setHistoryRefreshRevision((current) => current + 1);
    },
    providerIsReady && isVisible && !supportsRealtime
      ? historyRefreshInterval
      : null,
  );

  useInterval(
    () => {
      if (
        Date.now() - lastRealtimeActivityAtRef.current <
        REALTIME_STALE_THRESHOLD
      ) {
        return;
      }

      lastRealtimeActivityAtRef.current = Date.now();
      const subscription = realtimeSubscriptionRef.current;
      if (!subscription) {
        emitTradingViewNativeDebugEvent({
          details: { providerKey: seriesKey },
          level: 'warning',
          name: 'realtime.self-heal.resubscribe',
        });
        setRealtimeRetryRevision((current) => current + 1);
        return;
      }

      emitTradingViewNativeDebugEvent({
        details: { providerKey: seriesKey },
        level: 'warning',
        name: 'realtime.self-heal.start',
      });
      setRealtimeState((current) => ({
        ...current,
        error: undefined,
        status: 'reconnecting',
      }));
      void subscription
        .ensure()
        .then(() => {
          if (realtimeSubscriptionRef.current !== subscription) {
            return;
          }
          lastRealtimeActivityAtRef.current = Date.now();
          emitTradingViewNativeDebugEvent({
            details: { providerKey: seriesKey },
            name: 'realtime.self-heal.ready',
          });
          setRealtimeState((current) => ({
            ...current,
            error: undefined,
            status: 'live',
          }));
        })
        .catch((error: unknown) => {
          if (realtimeSubscriptionRef.current !== subscription) {
            return;
          }
          logTradingViewNativeDataError(
            'Failed to recover native TradingView realtime data',
            error,
          );
          emitTradingViewNativeDebugEvent({
            details: {
              error: getTradingViewNativeDebugErrorMessage(error),
              providerKey: seriesKey,
            },
            level: 'error',
            name: 'realtime.self-heal.error',
          });
          setRealtimeState((current) => ({
            ...current,
            error,
            status: 'error',
          }));
        });
    },
    supportsRealtime && isVisible ? REALTIME_SELF_HEAL_INTERVAL : null,
  );

  useEffect(() => {
    const skippedRequest = skipNextRequestRef.current;
    skipNextRequestRef.current = null;
    if (
      skippedRequest?.seriesKey === seriesKey &&
      skippedRequest.interval === activeInterval
    ) {
      emitTradingViewNativeDebugEvent({
        details: { interval: activeInterval, providerKey: seriesKey },
        name: 'history.initial.skipped',
      });
      return;
    }

    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    if (!providerIsReady) {
      emitTradingViewNativeDebugEvent({
        details: { interval: activeInterval, providerKey: seriesKey },
        level: 'warning',
        name: 'history.provider.not-ready',
      });
      setHistoryState({
        interval: activeInterval,
        seriesKey,
        status: 'idle',
      });
      return;
    }

    let isCancelled = false;
    const abortController = new AbortController();
    initialHistoryAbortControllerRef.current = abortController;
    const requestedInterval =
      getTradingViewNativeKLineInterval(activeInterval) ??
      TRADING_VIEW_NATIVE_KLINE_INTERVALS[4];
    const timeTo = Math.floor(Date.now() / 1000);
    const timeFrom = getHistoryTimeFrom({
      candleCount:
        historyProvider.getHistoryRequestCandleCount(requestedInterval),
      intervalSeconds: requestedInterval.seconds,
      timeTo,
    });
    setHistoryState((current) => ({
      interval: activeInterval,
      lastUpdatedAt:
        current.seriesKey === seriesKey ? current.lastUpdatedAt : undefined,
      seriesKey,
      status: 'loading',
    }));

    const rollbackInterval = (error: unknown) => {
      if (isCancelled || latestRequestIdRef.current !== requestId) {
        return;
      }
      const currentChartData = chartDataRef.current;
      if (
        currentChartData?.seriesKey === seriesKey &&
        currentChartData.interval !== requestedInterval.value
      ) {
        emitTradingViewNativeDebugEvent({
          details: {
            error: getTradingViewNativeDebugErrorMessage(error),
            fromInterval: requestedInterval.value,
            providerKey: seriesKey,
            toInterval: currentChartData.interval,
          },
          level: 'warning',
          name: 'interval.change.rolled-back',
        });
        skipNextRequestRef.current = {
          interval: currentChartData.interval,
          seriesKey,
        };
        setHistoryState((current) => ({
          interval: currentChartData.interval,
          lastUpdatedAt:
            current.seriesKey === seriesKey ? current.lastUpdatedAt : undefined,
          seriesKey,
          status: 'ready',
        }));
        setActiveInterval((currentInterval) =>
          currentInterval === requestedInterval.value
            ? currentChartData.interval
            : currentInterval,
        );
      } else {
        emitTradingViewNativeDebugEvent({
          details: {
            error: getTradingViewNativeDebugErrorMessage(error),
            interval: requestedInterval.value,
            providerKey: seriesKey,
          },
          level: 'error',
          name: 'history.initial.failed',
        });
        setHistoryState({
          error,
          interval: requestedInterval.value,
          seriesKey,
          status: 'error',
        });
      }
    };

    const fetchHistory = async () => {
      const requestAttemptBudget = createSparseHistoryRequestAttemptBudget();
      let lastError: unknown;
      let initialData: ITradingViewNativeHistoryResponse | undefined;
      let initialPoints: IMarketTokenKLineDataPoint[] | undefined;
      for (
        let attempt = 0;
        attempt <= HISTORY_RETRY_DELAYS.length;
        attempt += 1
      ) {
        try {
          consumeHistoryRequestAttempt(requestAttemptBudget);
          const data = await historyProvider.fetchHistory({
            interval: requestedInterval,
            signal: abortController.signal,
            timeFrom,
            timeTo,
          });
          if (isCancelled || latestRequestIdRef.current !== requestId) {
            return;
          }
          if (!data) {
            throw new OneKeyLocalError('No candle data is available');
          }
          const points = normalizeKLinePoints(data.points);
          if (!points.length) {
            throw new OneKeyLocalError('No candle data is available');
          }
          initialData = data;
          initialPoints = points;
          break;
        } catch (error) {
          if (isCancelled || isAbortError(error)) {
            return;
          }
          lastError = error;
          const retryDelay = HISTORY_RETRY_DELAYS[attempt];
          if (retryDelay === undefined) {
            break;
          }
          await waitForHistoryRetry(retryDelay, abortController.signal);
          if (isCancelled || abortController.signal.aborted) {
            return;
          }
        }
      }

      if (!initialData || !initialPoints) {
        const error =
          lastError ?? new OneKeyLocalError('No candle data is available');
        logTradingViewNativeDataError(
          'Failed to fetch native TradingView candle history',
          error,
        );
        rollbackInterval(error);
        return;
      }

      let points = initialPoints;
      const receivedHistoryPointCount = points.length;
      const initialEarliestTimestamp = points[0]?.t;
      const pageHasMoreHistory = historyProvider.hasMoreHistory({
        historySource: initialData.historySource,
        interval: requestedInterval,
        receivedPointCount: receivedHistoryPointCount,
      });
      const hasMoreHistory = getHasPotentialEarlierHistory({
        earliestTimestamp: initialEarliestTimestamp,
        historyBoundaryTimestamp: getCachedHistoryBoundaryTimestamp(
          getHistoryBoundaryPrefetchCacheKey(seriesKey),
        ),
        historySource: initialData.historySource,
        pageHasMoreHistory,
        sourceKind,
      });
      const pagination = historyPaginationRef.current;
      const shouldRecoverSparseHistory =
        sourceKind === 'market' &&
        (requestedInterval.value === '1' || requestedInterval.value === '5') &&
        initialData.historySource !== 'fallback' &&
        !pageHasMoreHistory &&
        pagination.seriesKey === seriesKey &&
        pagination.interval === requestedInterval.value &&
        pagination.earliestTimestamp === undefined &&
        initialEarliestTimestamp !== undefined;

      addHistoryCoverageRange({
        coverageState: historyCoverageRef.current,
        from: initialEarliestTimestamp,
        interval: requestedInterval.value,
        intervalSeconds: requestedInterval.seconds,
        seriesKey,
        to: points[points.length - 1]?.t,
      });
      const realtimeScope = realtimeScopeRef.current;
      if (
        realtimeScope.seriesKey === seriesKey &&
        realtimeScope.interval === requestedInterval.value &&
        realtimePointBufferRef.current.size > 0
      ) {
        points = mergeRealtimePointBuffer(
          points,
          realtimePointBufferRef.current.values(),
        );
        realtimePointBufferRef.current.clear();
      }
      const currentChartData = chartDataRef.current;
      const nextPoints =
        currentChartData?.seriesKey === seriesKey &&
        currentChartData.interval === requestedInterval.value
          ? mergeKLinePoints(currentChartData.points, points)
          : points;
      if (
        pagination.seriesKey === seriesKey &&
        pagination.interval === requestedInterval.value
      ) {
        if (pagination.earliestTimestamp === undefined) {
          pagination.hasMore = hasMoreHistory;
        }
        pagination.earliestTimestamp = nextPoints[0]?.t;
        pagination.hasMoreAfter = false;
        pagination.newerCursorTimestamp = timeTo;
      }
      setChartData((currentData) => ({
        chartPictureVersion:
          currentData?.seriesKey === seriesKey &&
          currentData.interval === requestedInterval.value
            ? currentData.chartPictureVersion + 1
            : 0,
        interval: requestedInterval.value,
        seriesKey,
        points:
          currentData?.seriesKey === seriesKey &&
          currentData.interval === requestedInterval.value
            ? mergeKLinePoints(currentData.points, points)
            : points,
      }));
      setHistoryState({
        interval: requestedInterval.value,
        lastUpdatedAt: Date.now(),
        seriesKey,
        status: 'ready',
      });

      if (
        !shouldRecoverSparseHistory ||
        initialEarliestTimestamp === undefined
      ) {
        return;
      }

      pagination.abortController = abortController;
      pagination.isLoading = true;
      const applyRecoveryProgress = createHistoryGapRecoveryProgressHandler({
        coverageState: historyCoverageRef.current,
        interval: requestedInterval.value,
        intervalSeconds: requestedInterval.seconds,
        isActive: () =>
          !isCancelled &&
          latestRequestIdRef.current === requestId &&
          historyPaginationRef.current === pagination,
        onPoints: (recoveryPoints) =>
          setChartData((currentData) =>
            mergeScopedChartDataPoints({
              currentData,
              interval: requestedInterval.value,
              points: recoveryPoints,
              seriesKey,
            }),
          ),
        pagination,
        seriesKey,
        timeTo: initialEarliestTimestamp - 1,
      });
      try {
        const recovery = await recoverOlderHistoryFromBoundary({
          historyProvider,
          interval: requestedInterval,
          onProgress: applyRecoveryProgress,
          requestAttemptBudget,
          seriesKey,
          signal: abortController.signal,
          targetPointCount: Math.max(
            TRADING_VIEW_NATIVE_TIME_RANGE_MAX_CANDLE_COUNT -
              receivedHistoryPointCount,
            1,
          ),
          timeTo: Math.max(initialEarliestTimestamp - 1, 0),
        });
        if (
          isCancelled ||
          latestRequestIdRef.current !== requestId ||
          historyPaginationRef.current !== pagination ||
          !recovery
        ) {
          return;
        }

        setHistoryBoundaryAvailableTimeRange({
          from: recovery.boundaryTimestamp,
          seriesKey,
        });
        if (recovery.historySource === 'fallback') {
          pagination.hasMore = false;
          return;
        }
        applyRecoveryProgress(recovery);
      } catch (error) {
        if (!isCancelled && !isAbortError(error)) {
          logTradingViewNativeDataError(
            'Failed to recover sparse native TradingView candle history',
            error,
          );
        }
      } finally {
        if (
          historyPaginationRef.current === pagination &&
          pagination.abortController === abortController
        ) {
          pagination.abortController = undefined;
          pagination.isLoading = false;
        }
      }
    };
    void fetchHistory().finally(() => {
      if (initialHistoryAbortControllerRef.current === abortController) {
        initialHistoryAbortControllerRef.current = null;
      }
    });

    return () => {
      isCancelled = true;
      abortController.abort();
      if (initialHistoryAbortControllerRef.current === abortController) {
        initialHistoryAbortControllerRef.current = null;
      }
    };
  }, [
    activeInterval,
    historyProvider,
    historyRefreshRevision,
    providerIsReady,
    seriesKey,
    setActiveInterval,
    sourceKind,
  ]);

  const dataState = useMemo(
    () =>
      getDataState({
        hasPoints: Boolean(visibleChartData?.points.length),
        historyState:
          historyState.seriesKey === seriesKey
            ? historyState
            : { interval: activeInterval, seriesKey, status: 'idle' },
        isVisible,
        providerIsReady,
        realtimeState:
          realtimeState.seriesKey === seriesKey
            ? realtimeState
            : { interval: activeInterval, seriesKey, status: 'idle' },
        supportsRealtime,
      }),
    [
      activeInterval,
      historyState,
      isVisible,
      providerIsReady,
      realtimeState,
      seriesKey,
      supportsRealtime,
      visibleChartData?.points.length,
    ],
  );
  const viewportRequest =
    scopedViewportRequest?.seriesKey === seriesKey &&
    scopedViewportRequest.interval === visibleChartData?.interval
      ? scopedViewportRequest
      : null;
  const calendarAvailableTimeRange = useMemo(
    () =>
      historyBoundaryAvailableTimeRange?.seriesKey === seriesKey
        ? {
            from: historyBoundaryAvailableTimeRange.from,
          }
        : undefined,
    [
      historyBoundaryAvailableTimeRange?.from,
      historyBoundaryAvailableTimeRange?.seriesKey,
      seriesKey,
    ],
  );
  return {
    calendarAvailableTimeRange,
    candleIntervalSeconds: displayedInterval.seconds,
    chartType: getTradingViewNativeChartType({
      hasSingleValueHistory: isSingleValueHistoryClassification(
        visibleHistoryPointTypeScopes?.get(
          getHistoryPointTypeScopeKey(
            visibleChartData?.seriesKey ?? seriesKey,
            visibleChartData?.interval ?? activeInterval,
          ),
        ),
      ),
      pointCount: visibleChartData?.points.length ?? 0,
    }),
    chartPictureVersion: visibleChartData?.chartPictureVersion ?? 0,
    dataProviderKey: seriesKey,
    dataState,
    getVisibleTimeRange,
    handleHistoryBoundaryPrefetch,
    handleIntervalChange,
    handleRetry,
    handleViewportTargetChange,
    handleViewportRequestApplied,
    handleVisiblePointRangeChange,
    intervalConfig,
    isSwitchingInterval,
    points: visibleChartData?.points ?? [],
    viewportRequest,
  };
}
