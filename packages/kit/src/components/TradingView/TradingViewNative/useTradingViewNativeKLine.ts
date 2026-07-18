import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { fetchMarketKLineDataWithSlicing } from '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketKLineData';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import type { ITradingViewIntervalOption } from '../TradingViewChartControls/types';

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
  marketKey: string;
  points: IMarketTokenKLineDataPoint[];
}

function buildMarketKey(networkId: string, tokenAddress: string) {
  return `${networkId}:${tokenAddress}`;
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

export function useTradingViewNativeKLine({
  networkId,
  tokenAddress,
}: {
  networkId: string;
  tokenAddress: string;
}) {
  const marketKey = buildMarketKey(networkId, tokenAddress);
  const latestRequestIdRef = useRef(0);
  const skipNextRequestRef = useRef<{
    interval: string;
    marketKey: string;
  } | null>(null);
  const chartDataRef = useRef<IChartData | null>(null);
  const [chartData, setChartData] = useState<IChartData | null>(null);
  const [activeInterval, setActiveInterval] = useState(DEFAULT_KLINE_INTERVAL);
  chartDataRef.current = chartData;

  const visibleChartData =
    chartData?.marketKey === marketKey ? chartData : null;
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

  useEffect(() => {
    const skippedRequest = skipNextRequestRef.current;
    skipNextRequestRef.current = null;
    if (
      skippedRequest?.marketKey === marketKey &&
      skippedRequest.interval === activeInterval
    ) {
      return;
    }

    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;

    if (!networkId) {
      return;
    }

    const requestedInterval = getKLineIntervalOption(activeInterval);
    const timeTo = Math.floor(Date.now() / 1000);
    const timeFrom = timeTo - requestedInterval.seconds * MAX_VISIBLE_CANDLES;

    const rollbackInterval = () => {
      if (latestRequestIdRef.current !== requestId) {
        return;
      }
      const currentChartData = chartDataRef.current;
      if (currentChartData?.marketKey === marketKey) {
        skipNextRequestRef.current = {
          interval: currentChartData.interval,
          marketKey,
        };
        setActiveInterval((currentInterval) =>
          currentInterval === requestedInterval.value
            ? currentChartData.interval
            : currentInterval,
        );
      }
    };

    void fetchMarketKLineDataWithSlicing({
      tokenAddress,
      networkId,
      interval: requestedInterval.label,
      timeFrom,
      timeTo,
      autoHandleError: false,
    })
      .then((data) => {
        if (latestRequestIdRef.current !== requestId) {
          return;
        }
        const points = normalizeKLinePoints(data?.points ?? []);
        if (!points.length) {
          rollbackInterval();
          return;
        }
        setChartData({
          interval: requestedInterval.value,
          marketKey,
          points,
        });
      })
      .catch(rollbackInterval);
  }, [activeInterval, marketKey, networkId, tokenAddress]);

  return {
    candleIntervalSeconds,
    points: visibleChartData?.points ?? [],
    intervalConfig,
    isSwitchingInterval,
    handleIntervalChange,
  };
}
