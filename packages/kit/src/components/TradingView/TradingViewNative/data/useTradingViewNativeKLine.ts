import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { fetchMarketKLineDataWithSlicing } from '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketKLineData';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { fetchTradingViewNativeHyperliquidKLine } from './fetchTradingViewNativeHyperliquidKLine';
import { useTradingViewNativeHyperliquidWebSocket } from './useTradingViewNativeHyperliquidWebSocket';
import { useTradingViewNativeMarketWebSocket } from './useTradingViewNativeMarketWebSocket';

import type { ITradingViewIntervalOption } from '../../TradingViewChartControls/types';
import type { ITradingViewNativeDataSource } from '../types';

const DEFAULT_KLINE_INTERVAL = '60';
const MAX_VISIBLE_CANDLES = 160;

type IKLineInterval = ITradingViewIntervalOption & { seconds: number };

export const TRADING_VIEW_NATIVE_KLINE_INTERVALS: IKLineInterval[] = [
  { label: '1m', value: '1', seconds: 60 },
  { label: '5m', value: '5', seconds: 5 * 60 },
  { label: '15m', value: '15', seconds: 15 * 60 },
  { label: '30m', value: '30', seconds: 30 * 60 },
  { label: '1H', value: '60', seconds: 60 * 60 },
  { label: '4H', value: '240', seconds: 4 * 60 * 60 },
  { label: '1D', value: '1D', seconds: 24 * 60 * 60 },
  { label: '1W', value: '1W', seconds: 7 * 24 * 60 * 60 },
];

function getKLineIntervalOption(interval: string) {
  return (
    TRADING_VIEW_NATIVE_KLINE_INTERVALS.find(
      (option) => option.value === interval,
    ) ?? TRADING_VIEW_NATIVE_KLINE_INTERVALS[4]
  );
}

interface IChartData {
  interval: string;
  seriesKey: string;
  points: IMarketTokenKLineDataPoint[];
}

interface IRealtimePoint {
  interval: string;
  seriesKey: string;
  point: IMarketTokenKLineDataPoint;
}

function buildSeriesKey({
  dataProvider,
  hyperliquidCoin,
  networkId,
  tokenAddress,
}: {
  dataProvider: 'hyperliquid' | 'market';
  hyperliquidCoin: string;
  networkId: string;
  tokenAddress: string;
}) {
  return dataProvider === 'hyperliquid'
    ? `hyperliquid:${hyperliquidCoin}`
    : `market:${networkId}:${tokenAddress}`;
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

export function useTradingViewNativeKLine({
  networkId,
  tokenAddress,
  symbol = '',
  hyperliquidCoin = '',
  dataSource = 'market-polling',
}: {
  networkId: string;
  tokenAddress: string;
  symbol?: string;
  hyperliquidCoin?: string;
  dataSource?: ITradingViewNativeDataSource;
}) {
  const dataProvider = dataSource === 'hyperliquid' ? 'hyperliquid' : 'market';
  const seriesKey = buildSeriesKey({
    dataProvider,
    hyperliquidCoin,
    networkId,
    tokenAddress,
  });
  const latestRequestIdRef = useRef(0);
  const skipNextRequestRef = useRef<{
    interval: string;
    seriesKey: string;
  } | null>(null);
  const chartDataRef = useRef<IChartData | null>(null);
  const [chartData, setChartData] = useState<IChartData | null>(null);
  const [activeInterval, setActiveInterval] = useState(DEFAULT_KLINE_INTERVAL);
  const realtimePointBufferRef = useRef(
    new Map<number, IMarketTokenKLineDataPoint>(),
  );
  const realtimeScopeRef = useRef({ interval: activeInterval, seriesKey });
  chartDataRef.current = chartData;

  useEffect(() => {
    realtimeScopeRef.current = { interval: activeInterval, seriesKey };
    realtimePointBufferRef.current.clear();
  }, [activeInterval, seriesKey]);

  const visibleChartData =
    chartData?.seriesKey === seriesKey ? chartData : null;
  const isSwitchingInterval = Boolean(
    visibleChartData && visibleChartData.interval !== activeInterval,
  );
  const candleIntervalSeconds = getKLineIntervalOption(
    visibleChartData?.interval ?? activeInterval,
  ).seconds;
  const intervalConfig = useMemo(
    () => ({
      intervals: TRADING_VIEW_NATIVE_KLINE_INTERVALS,
      activeInterval,
    }),
    [activeInterval],
  );

  const handleIntervalChange = useCallback((interval: string) => {
    if (
      TRADING_VIEW_NATIVE_KLINE_INTERVALS.some(
        (option) => option.value === interval,
      )
    ) {
      setActiveInterval(interval);
    }
  }, []);

  const handleRealtimePoint = useCallback(
    (point: IMarketTokenKLineDataPoint) => {
      const realtimePoint: IRealtimePoint = {
        interval: activeInterval,
        seriesKey,
        point,
      };
      const realtimeScope = realtimeScopeRef.current;
      if (
        realtimeScope.seriesKey !== realtimePoint.seriesKey ||
        realtimeScope.interval !== realtimePoint.interval
      ) {
        return;
      }
      bufferRealtimePoint(realtimePointBufferRef.current, realtimePoint.point);
      setChartData((currentChartData) => {
        if (
          currentChartData?.seriesKey !== realtimePoint.seriesKey ||
          currentChartData.interval !== realtimePoint.interval
        ) {
          return currentChartData;
        }

        const points = mergeRealtimePoint(
          currentChartData.points,
          realtimePoint.point,
        );
        return points === currentChartData.points
          ? currentChartData
          : { ...currentChartData, points };
      });
    },
    [activeInterval, seriesKey],
  );

  useTradingViewNativeMarketWebSocket({
    enabled: dataSource === 'market-websocket',
    networkId,
    tokenAddress,
    symbol,
    chartType: activeInterval,
    onKLineUpdate: handleRealtimePoint,
  });

  useTradingViewNativeHyperliquidWebSocket({
    enabled: dataProvider === 'hyperliquid',
    coin: hyperliquidCoin,
    chartInterval: activeInterval,
    onKLineUpdate: handleRealtimePoint,
  });

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

    if (
      (dataProvider === 'market' && !networkId) ||
      (dataProvider === 'hyperliquid' && !hyperliquidCoin)
    ) {
      return;
    }

    let isCancelled = false;
    const abortController = new AbortController();

    const requestedInterval = getKLineIntervalOption(activeInterval);
    const timeTo = Math.floor(Date.now() / 1000);
    const timeFrom = timeTo - requestedInterval.seconds * MAX_VISIBLE_CANDLES;

    const rollbackInterval = () => {
      if (isCancelled || latestRequestIdRef.current !== requestId) {
        return;
      }
      const currentChartData = chartDataRef.current;
      if (currentChartData?.seriesKey === seriesKey) {
        skipNextRequestRef.current = {
          interval: currentChartData.interval,
          seriesKey,
        };
        setActiveInterval((currentInterval) =>
          currentInterval === requestedInterval.value
            ? currentChartData.interval
            : currentInterval,
        );
      }
    };

    const request =
      dataProvider === 'hyperliquid'
        ? fetchTradingViewNativeHyperliquidKLine({
            coin: hyperliquidCoin,
            interval: requestedInterval.value,
            timeFrom,
            timeTo,
            signal: abortController.signal,
          })
        : fetchMarketKLineDataWithSlicing({
            tokenAddress,
            networkId,
            interval: requestedInterval.label,
            timeFrom,
            timeTo,
            autoHandleError: false,
          });

    void request
      .then((data) => {
        if (isCancelled || latestRequestIdRef.current !== requestId) {
          return;
        }
        let points = normalizeKLinePoints(data?.points ?? []);
        if (!points.length) {
          rollbackInterval();
          return;
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
        setChartData({
          interval: requestedInterval.value,
          seriesKey,
          points,
        });
      })
      .catch(() => rollbackInterval());

    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [
    activeInterval,
    dataProvider,
    hyperliquidCoin,
    networkId,
    seriesKey,
    tokenAddress,
  ]);

  return {
    candleIntervalSeconds,
    dataProviderKey: seriesKey,
    points: visibleChartData?.points ?? [],
    intervalConfig,
    isSwitchingInterval,
    handleIntervalChange,
  };
}
