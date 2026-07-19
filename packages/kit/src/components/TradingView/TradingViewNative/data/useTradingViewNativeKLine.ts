import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getCurrentVisibilityState,
  onVisibilityStateChange,
} from '@onekeyhq/components/src/hooks/useVisibilityChange';
import { useInterval } from '@onekeyhq/kit/src/hooks/useInterval';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { createTradingViewNativeDataProvider } from './createTradingViewNativeDataProvider';
import { logTradingViewNativeDataError } from './tradingViewNativeDataLogger';
import {
  DEFAULT_TRADING_VIEW_NATIVE_KLINE_INTERVAL,
  TRADING_VIEW_NATIVE_KLINE_INTERVALS,
  getTradingViewNativeKLineInterval,
} from './tradingViewNativeIntervals';

import type { ITradingViewNativeRealtimeSubscription } from './tradingViewNativeDataProviderTypes';
import type { ITradingViewNativeChartInterval } from './tradingViewNativeIntervals';
import type {
  ITradingViewNativeDataState,
  ITradingViewNativeSource,
} from '../types';

const MAX_VISIBLE_CANDLES = 160;
const HISTORY_RETRY_DELAYS = [1000, 3000] as const;
const REALTIME_SELF_HEAL_INTERVAL = 30_000;
const REALTIME_STALE_THRESHOLD = 60_000;

let realtimeSubscriberSequence = 0;

interface IChartData {
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
    .toSorted((a, b) => a.t - b.t)
    .slice(-MAX_VISIBLE_CANDLES);
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
  const existingPointIndex = points.findIndex(
    (point) => point.t === realtimePoint.t,
  );
  if (existingPointIndex === -1) {
    return normalizeKLinePoints([...points, realtimePoint]);
  }
  if (areKLinePointsEqual(points[existingPointIndex], realtimePoint)) {
    return points;
  }

  const nextPoints = [...points];
  nextPoints[existingPointIndex] = realtimePoint;
  return nextPoints;
}

function bufferRealtimePoint(
  buffer: Map<number, IMarketTokenKLineDataPoint>,
  point: IMarketTokenKLineDataPoint,
) {
  buffer.set(point.t, point);
  if (buffer.size <= MAX_VISIBLE_CANDLES) {
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
  const pointsByTimestamp = new Map<number, IMarketTokenKLineDataPoint>();
  points.forEach((point) => pointsByTimestamp.set(point.t, point));
  for (const realtimePoint of realtimePoints) {
    pointsByTimestamp.set(realtimePoint.t, realtimePoint);
  }
  return normalizeKLinePoints([...pointsByTimestamp.values()]);
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
  source,
}: {
  source: ITradingViewNativeSource;
}) {
  const sourceKind = source.kind;
  const hyperliquidCoin = source.kind === 'hyperliquid' ? source.coin : '';
  const hyperliquidEnvironment =
    source.kind === 'hyperliquid' ? source.environment : 'mainnet';
  const marketNetworkId = source.kind === 'market' ? source.networkId : '';
  const marketTokenAddress =
    source.kind === 'market' ? source.tokenAddress : '';
  const marketSymbol = source.kind === 'market' ? source.symbol : '';
  const marketRealtime =
    source.kind === 'market' ? source.realtime : 'disabled';
  const provider = useMemo(
    () =>
      sourceKind === 'hyperliquid'
        ? createTradingViewNativeDataProvider({
            kind: 'hyperliquid',
            coin: hyperliquidCoin,
            environment: hyperliquidEnvironment,
          })
        : createTradingViewNativeDataProvider({
            kind: 'market',
            networkId: marketNetworkId,
            tokenAddress: marketTokenAddress,
            symbol: marketSymbol,
            realtime: marketRealtime,
          }),
    [
      hyperliquidCoin,
      hyperliquidEnvironment,
      marketNetworkId,
      marketRealtime,
      marketSymbol,
      marketTokenAddress,
      sourceKind,
    ],
  );
  const seriesKey = provider.key;
  const latestRequestIdRef = useRef(0);
  const skipNextRequestRef = useRef<{
    interval: ITradingViewNativeChartInterval;
    seriesKey: string;
  } | null>(null);
  const chartDataRef = useRef<IChartData | null>(null);
  const realtimeSubscriptionRef =
    useRef<ITradingViewNativeRealtimeSubscription | null>(null);
  const lastRealtimeActivityAtRef = useRef(Date.now());
  const lastRealtimePointAtRef = useRef<number | undefined>(undefined);
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
    lastRealtimePointAtRef.current = undefined;
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

  const handleRealtimePoint = useCallback(
    (point: IMarketTokenKLineDataPoint) => {
      const realtimeScope = realtimeScopeRef.current;
      if (
        realtimeScope.seriesKey !== seriesKey ||
        realtimeScope.interval !== activeInterval
      ) {
        return;
      }

      const updatedAt = Date.now();
      lastRealtimeActivityAtRef.current = updatedAt;
      lastRealtimePointAtRef.current = updatedAt;
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
            interval: activeInterval,
            seriesKey,
            points: [point],
          };
        }

        const points = mergeRealtimePoint(currentChartData.points, point);
        return points === currentChartData.points
          ? currentChartData
          : { ...currentChartData, points };
      });
    },
    [activeInterval, seriesKey],
  );

  useEffect(() => {
    if (!provider.isReady || !provider.supportsRealtime || !isVisible) {
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
        const nextSubscription = await provider.subscribeRealtime({
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
          let status: IRealtimeState['status'] = 'idle';
          if (nextSubscription) {
            status =
              current.seriesKey === seriesKey && current.status === 'live'
                ? 'live'
                : 'reconnecting';
          }
          return {
            interval: activeInterval,
            lastUpdatedAt:
              current.seriesKey === seriesKey
                ? current.lastUpdatedAt
                : undefined,
            seriesKey,
            status,
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
    provider,
    realtimeRetryRevision,
    seriesKey,
    subscriberId,
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

      const lastPointAtRecoveryStart = lastRealtimePointAtRef.current;

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
            status:
              lastRealtimePointAtRef.current !== lastPointAtRecoveryStart
                ? 'live'
                : 'reconnecting',
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
    provider.isReady && provider.supportsRealtime && isVisible
      ? REALTIME_SELF_HEAL_INTERVAL
      : null,
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
    if (!provider.isReady) {
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
    const timeFrom = timeTo - requestedInterval.seconds * MAX_VISIBLE_CANDLES;
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
          const data = await provider.fetchHistory({
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
          setChartData({
            interval: requestedInterval.value,
            seriesKey,
            points,
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
  }, [activeInterval, historyRefreshRevision, provider, seriesKey]);

  const dataState = useMemo(
    () =>
      getDataState({
        hasPoints: Boolean(visibleChartData?.points.length),
        historyState:
          historyState.seriesKey === seriesKey
            ? historyState
            : { interval: activeInterval, seriesKey, status: 'idle' },
        isVisible,
        providerIsReady: provider.isReady,
        realtimeState:
          realtimeState.seriesKey === seriesKey
            ? realtimeState
            : { interval: activeInterval, seriesKey, status: 'idle' },
        supportsRealtime: provider.supportsRealtime,
      }),
    [
      activeInterval,
      historyState,
      isVisible,
      provider.isReady,
      provider.supportsRealtime,
      realtimeState,
      seriesKey,
      visibleChartData?.points.length,
    ],
  );
  return {
    candleIntervalSeconds: displayedInterval.seconds,
    dataProviderKey: seriesKey,
    dataState,
    handleIntervalChange,
    intervalConfig,
    isSwitchingInterval,
    points: visibleChartData?.points ?? [],
  };
}
