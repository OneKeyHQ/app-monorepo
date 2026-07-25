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
  mergeTradingViewNativePointTypes,
} from '../utils/chartType';

import { createTradingViewNativeDataProvider } from './providers/createTradingViewNativeDataProvider';
import { logTradingViewNativeDataError } from './tradingViewNativeDataLogger';
import {
  DEFAULT_TRADING_VIEW_NATIVE_KLINE_INTERVAL,
  TRADING_VIEW_NATIVE_KLINE_INTERVALS,
  getTradingViewNativeKLineInterval,
} from './tradingViewNativeIntervals';

import type { ITradingViewNativeRealtimeSubscription } from './providers/types';
import type { ITradingViewNativeChartInterval } from './tradingViewNativeIntervals';
import type { IMarketKLinePointType } from '../../utils/fetchMarketKLineData';
import type {
  ITradingViewNativeDataState,
  ITradingViewNativeSource,
} from '../types';

const HISTORY_LOAD_MORE_THRESHOLD = 20;
const HISTORY_RETRY_DELAYS = [1000, 3000] as const;
const MAX_REALTIME_BUFFER_CANDLES = 160;
const REALTIME_SELF_HEAL_INTERVAL = 30_000;
const REALTIME_STALE_THRESHOLD = 60_000;

let realtimeSubscriberSequence = 0;

interface IChartData {
  chartPictureVersion: number;
  interval: ITradingViewNativeChartInterval;
  pointType: IMarketKLinePointType;
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
  interval: ITradingViewNativeChartInterval;
  isLoading: boolean;
  seriesKey: string;
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
  const hyperliquidCoin = source.kind === 'hyperliquid' ? source.coin : '';
  const hyperliquidEnvironment =
    source.kind === 'hyperliquid' ? source.environment : 'mainnet';
  const marketFallbackCoinGeckoId =
    source.kind === 'market' ? source.fallbackCoinGeckoId : undefined;
  const marketNetworkId = source.kind === 'market' ? source.networkId : '';
  const marketTokenAddress =
    source.kind === 'market' ? source.tokenAddress : '';
  const marketSymbol = source.kind === 'market' ? source.symbol : '';
  const marketRealtime =
    source.kind === 'market' ? source.realtime : 'disabled';
  const historyProvider = useMemo(() => {
    if (sourceKind === 'hyperliquid') {
      return createTradingViewNativeDataProvider({
        kind: 'hyperliquid',
        coin: hyperliquidCoin,
        environment: hyperliquidEnvironment,
      });
    }
    return createTradingViewNativeDataProvider({
      kind: 'market',
      fallbackCoinGeckoId: marketFallbackCoinGeckoId,
      networkId: marketNetworkId,
      tokenAddress: marketTokenAddress,
      symbol: marketSymbol,
      realtime: 'disabled',
    });
  }, [
    hyperliquidCoin,
    hyperliquidEnvironment,
    marketFallbackCoinGeckoId,
    marketNetworkId,
    marketSymbol,
    marketTokenAddress,
    sourceKind,
  ]);
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
      networkId: marketNetworkId,
      tokenAddress: marketTokenAddress,
      symbol: marketSymbol,
      realtime: 'websocket',
    });
  }, [
    historyProvider,
    marketFallbackCoinGeckoId,
    marketNetworkId,
    marketRealtime,
    marketSymbol,
    marketTokenAddress,
    sourceKind,
  ]);
  const providerIsReady = historyProvider.isReady;
  const supportsRealtime = Boolean(
    realtimeProvider?.isReady && realtimeProvider.supportsRealtime,
  );
  const seriesKey = historyProvider.key;
  const latestRequestIdRef = useRef(0);
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
  const [activeInterval, setActiveInterval] =
    useState<ITradingViewNativeChartInterval>(
      DEFAULT_TRADING_VIEW_NATIVE_KLINE_INTERVAL,
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
    interval: activeInterval,
    isLoading: false,
    seriesKey,
  });
  onRealtimePointRef.current = onRealtimePoint;
  chartDataRef.current = chartData;

  useEffect(() => {
    const currentVisibility = getCurrentVisibilityState();
    isVisibleRef.current = currentVisibility;
    setIsVisible(currentVisibility);
    return onVisibilityStateChange((nextVisibility) => {
      const wasVisible = isVisibleRef.current;
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
    historyPaginationRef.current.abortController?.abort();
    const currentChartData = chartDataRef.current;
    historyPaginationRef.current = {
      earliestTimestamp:
        currentChartData?.seriesKey === seriesKey &&
        currentChartData.interval === activeInterval
          ? currentChartData.points[0]?.t
          : undefined,
      hasMore: true,
      interval: activeInterval,
      isLoading: false,
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

  const handleIntervalChange = useCallback((interval: string) => {
    const nextInterval = getTradingViewNativeKLineInterval(interval);
    if (nextInterval) {
      setActiveInterval(nextInterval.value);
    }
  }, []);

  const handleRetry = useCallback(() => {
    setHistoryRefreshRevision((current) => current + 1);
    setRealtimeRetryRevision((current) => current + 1);
  }, []);

  const handleVisiblePointRangeChange = useCallback(
    ({ startIndex }: { startIndex: number }) => {
      if (startIndex > HISTORY_LOAD_MORE_THRESHOLD) {
        return;
      }

      const pagination = historyPaginationRef.current;
      const currentChartData = chartDataRef.current;
      if (
        pagination.seriesKey !== seriesKey ||
        pagination.interval !== activeInterval ||
        pagination.isLoading ||
        !pagination.hasMore ||
        currentChartData?.seriesKey !== seriesKey ||
        currentChartData.interval !== activeInterval
      ) {
        return;
      }

      const interval =
        getTradingViewNativeKLineInterval(activeInterval) ??
        TRADING_VIEW_NATIVE_KLINE_INTERVALS[4];
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
      const timeFrom = getHistoryTimeFrom({
        candleCount: historyProvider.getHistoryRequestCandleCount(interval),
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
        let lastError: unknown;
        try {
          for (
            let attempt = 0;
            attempt <= HISTORY_RETRY_DELAYS.length;
            attempt += 1
          ) {
            try {
              const data = await historyProvider.fetchHistory({
                interval,
                signal: abortController.signal,
                timeFrom,
                timeTo,
              });
              if (
                abortController.signal.aborted ||
                historyPaginationRef.current !== pagination
              ) {
                return;
              }
              if (!data) {
                throw new OneKeyLocalError(
                  'No older candle history response is available',
                );
              }

              const olderPoints = normalizeKLinePoints(data.points).filter(
                (point) => point.t < earliestTimestamp,
              );
              if (!olderPoints.length) {
                pagination.hasMore = false;
                return;
              }

              pagination.earliestTimestamp = olderPoints[0].t;
              pagination.hasMore = historyProvider.hasMoreHistory({
                historySource: data.historySource,
                interval,
                receivedPointCount: olderPoints.length,
              });
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
                  pointType: mergeTradingViewNativePointTypes(
                    currentData.pointType,
                    data.pointType,
                  ),
                  points: mergeKLinePoints(currentData.points, olderPoints),
                };
              });
              return;
            } catch (error) {
              if (abortController.signal.aborted || isAbortError(error)) {
                return;
              }
              lastError = error;
              const retryDelay = HISTORY_RETRY_DELAYS[attempt];
              if (retryDelay === undefined) {
                break;
              }
              await waitForHistoryRetry(retryDelay, abortController.signal);
              if (abortController.signal.aborted) {
                return;
              }
            }
          }

          logTradingViewNativeDataError(
            'Failed to fetch older native TradingView candle history',
            lastError ??
              new OneKeyLocalError(
                'No older candle history response is available',
              ),
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
    [activeInterval, historyProvider, seriesKey],
  );

  const handleRealtimePoint = useCallback(
    (point: IMarketTokenKLineDataPoint) => {
      const realtimeScope = realtimeScopeRef.current;
      if (
        realtimeScope.seriesKey !== seriesKey ||
        realtimeScope.interval !== activeInterval
      ) {
        return;
      }

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
      setChartData((currentChartData) => {
        if (
          currentChartData?.seriesKey === seriesKey &&
          currentChartData.interval !== activeInterval
        ) {
          return currentChartData;
        }

        if (!currentChartData || currentChartData.seriesKey !== seriesKey) {
          return {
            chartPictureVersion: 0,
            interval: activeInterval,
            pointType: 'ohlc',
            seriesKey,
            points: [point],
          };
        }

        const mergeResult = mergeRealtimePoint(currentChartData.points, point);
        return mergeResult.points === currentChartData.points
          ? currentChartData
          : {
              ...currentChartData,
              chartPictureVersion:
                currentChartData.chartPictureVersion +
                (mergeResult.didChangeHistoricalPoints ? 1 : 0),
              points: mergeResult.points,
            };
      });
    },
    [activeInterval, seriesKey],
  );

  useEffect(() => {
    if (!realtimeProvider || !supportsRealtime || !isVisible) {
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
      if (
        Date.now() - lastRealtimeActivityAtRef.current <
        REALTIME_STALE_THRESHOLD
      ) {
        return;
      }

      lastRealtimeActivityAtRef.current = Date.now();
      const subscription = realtimeSubscriptionRef.current;
      if (!subscription) {
        setRealtimeRetryRevision((current) => current + 1);
        return;
      }

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
      return;
    }

    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    if (!providerIsReady) {
      setHistoryState({
        interval: activeInterval,
        seriesKey,
        status: 'idle',
      });
      return;
    }

    let isCancelled = false;
    const abortController = new AbortController();
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
        setHistoryState({
          error,
          interval: requestedInterval.value,
          seriesKey,
          status: 'error',
        });
      }
    };

    const fetchHistory = async () => {
      let lastError: unknown;
      for (
        let attempt = 0;
        attempt <= HISTORY_RETRY_DELAYS.length;
        attempt += 1
      ) {
        try {
          const data = await historyProvider.fetchHistory({
            interval: requestedInterval,
            signal: abortController.signal,
            timeFrom,
            timeTo,
          });
          if (isCancelled || latestRequestIdRef.current !== requestId) {
            return;
          }
          let points = normalizeKLinePoints(data?.points ?? []);
          if (!points.length) {
            throw new OneKeyLocalError('No candle data is available');
          }
          const receivedHistoryPointCount = points.length;
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
          const updatedAt = Date.now();
          const currentChartData = chartDataRef.current;
          const nextPoints =
            currentChartData?.seriesKey === seriesKey &&
            currentChartData.interval === requestedInterval.value
              ? mergeKLinePoints(currentChartData.points, points)
              : points;
          const pagination = historyPaginationRef.current;
          if (
            pagination.seriesKey === seriesKey &&
            pagination.interval === requestedInterval.value
          ) {
            if (pagination.earliestTimestamp === undefined) {
              pagination.hasMore = historyProvider.hasMoreHistory({
                historySource: data?.historySource,
                interval: requestedInterval,
                receivedPointCount: receivedHistoryPointCount,
              });
            }
            pagination.earliestTimestamp = nextPoints[0]?.t;
          }
          setChartData((currentData) => {
            const shouldMergeCurrentData =
              currentData?.seriesKey === seriesKey &&
              currentData.interval === requestedInterval.value;
            return {
              chartPictureVersion: shouldMergeCurrentData
                ? currentData.chartPictureVersion + 1
                : 0,
              interval: requestedInterval.value,
              pointType: shouldMergeCurrentData
                ? mergeTradingViewNativePointTypes(
                    currentData.pointType,
                    data?.pointType,
                  )
                : (data?.pointType ?? 'ohlc'),
              seriesKey,
              points: shouldMergeCurrentData
                ? mergeKLinePoints(currentData.points, points)
                : points,
            };
          });
          setHistoryState({
            interval: requestedInterval.value,
            lastUpdatedAt: updatedAt,
            seriesKey,
            status: 'ready',
          });
          return;
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

      const error =
        lastError ?? new OneKeyLocalError('No candle data is available');
      logTradingViewNativeDataError(
        'Failed to fetch native TradingView candle history',
        error,
      );
      rollbackInterval(error);
    };
    void fetchHistory();

    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [
    activeInterval,
    historyProvider,
    historyRefreshRevision,
    providerIsReady,
    seriesKey,
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
  return {
    candleIntervalSeconds: displayedInterval.seconds,
    chartType: getTradingViewNativeChartType({
      pointCount: visibleChartData?.points.length ?? 0,
      pointType: visibleChartData?.pointType,
    }),
    chartPictureVersion: visibleChartData?.chartPictureVersion ?? 0,
    dataProviderKey: seriesKey,
    dataState,
    handleIntervalChange,
    handleRetry,
    handleVisiblePointRangeChange,
    intervalConfig,
    isSwitchingInterval,
    points: visibleChartData?.points ?? [],
  };
}
