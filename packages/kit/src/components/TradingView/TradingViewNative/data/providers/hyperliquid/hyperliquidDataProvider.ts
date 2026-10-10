import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { getTradingViewNativeSourceKey } from '../../getTradingViewNativeSource';

import {
  HYPERLIQUID_DAY_SECONDS,
  aggregateHyperliquidCalendarCandles,
  getHyperliquidCalendarBucketEnd,
  getHyperliquidCalendarBucketStart,
  isHyperliquidCalendarInterval,
} from './hyperliquidCandleUtils';
import { tradingViewNativeHyperliquidGateway } from './tradingViewNativeHyperliquidGateway';

import type { IHyperliquidCalendarInterval } from './hyperliquidCandleUtils';
import type { ITradingViewNativeSource } from '../../../types';
import type {
  ITradingViewNativeDataProvider,
  ITradingViewNativeRealtimeSubscriptionRequest,
} from '../types';

type IHyperliquidSource = Extract<
  ITradingViewNativeSource,
  { kind: 'hyperliquid' }
>;

const HYPERLIQUID_HISTORY_BATCH_SIZE = 5000;

async function subscribeCalendarCandles({
  source,
  calendarInterval,
  onPoint,
  signal,
  subscriberId,
}: ITradingViewNativeRealtimeSubscriptionRequest & {
  source: IHyperliquidSource;
  calendarInterval: IHyperliquidCalendarInterval;
}) {
  let days = new Map<number, IMarketTokenKLineDataPoint>();
  let latestDay =
    Math.floor(Date.now() / 1000 / HYPERLIQUID_DAY_SECONDS) *
    HYPERLIQUID_DAY_SECONDS;
  let refreshedThroughDay = -1;
  let refreshPromise: Promise<void> | undefined;
  let pendingPoint: IMarketTokenKLineDataPoint | undefined;
  let closed = false;
  const isActive = () => !closed && !signal.aborted;

  const publish = () => {
    if (!isActive() || refreshedThroughDay < latestDay) {
      return;
    }
    const point = aggregateHyperliquidCalendarCandles(
      Array.from(days.values()),
      calendarInterval,
    ).at(-1);
    if (point) {
      pendingPoint = undefined;
      onPoint(point);
    }
  };

  const refresh = (): Promise<void> => {
    if (refreshPromise) {
      return refreshPromise;
    }
    refreshPromise = (async () => {
      while (isActive() && refreshedThroughDay < latestDay) {
        const requestedDay = latestDay;
        const bucketStart = getHyperliquidCalendarBucketStart(
          requestedDay,
          calendarInterval,
        );
        // Separate updates arriving during HTTP from the older cached snapshot.
        const previousDays = days;
        const triggeringPoint = pendingPoint;
        pendingPoint = undefined;
        days = new Map();
        const response = await tradingViewNativeHyperliquidGateway.fetchCandles(
          {
            coin: source.coin,
            environment: source.environment,
            interval: '1d',
            signal,
            timeFrom: bucketStart,
            timeTo: requestedDay + HYPERLIQUID_DAY_SECONDS - 1,
          },
        );
        if (!isActive()) {
          return;
        }
        const currentBucket = getHyperliquidCalendarBucketStart(
          latestDay,
          calendarInterval,
        );
        days = new Map(
          [
            ...previousDays.entries(),
            ...response.points.map(
              (point): [number, IMarketTokenKLineDataPoint] => [point.t, point],
            ),
            ...(triggeringPoint
              ? [
                  [triggeringPoint.t, triggeringPoint] as [
                    number,
                    IMarketTokenKLineDataPoint,
                  ],
                ]
              : []),
            ...days.entries(),
          ].filter(([timestamp]) => timestamp >= currentBucket),
        );
        refreshedThroughDay = requestedDay;
      }
      publish();
    })().finally(() => {
      refreshPromise = undefined;
    });
    return refreshPromise;
  };

  const subscription =
    await tradingViewNativeHyperliquidGateway.subscribeCandle({
      coin: source.coin,
      environment: source.environment,
      interval: '1d',
      subscriberId,
      listener: (point) => {
        if (
          !isActive() ||
          point.t <
            getHyperliquidCalendarBucketStart(latestDay, calendarInterval)
        ) {
          return;
        }
        latestDay = Math.max(latestDay, point.t);
        pendingPoint = point;
        days.set(point.t, point);
        if (refreshedThroughDay < latestDay) {
          void refresh().catch((error: unknown) => {
            if (isActive()) {
              defaultLogger.networkDoctor.log.error({
                info: `Failed to refresh Hyperliquid calendar candle: ${String(
                  error,
                )}`,
              });
            }
          });
        } else {
          publish();
        }
      },
    });

  try {
    await refresh();
  } catch (error) {
    closed = true;
    await subscription.unsubscribe();
    throw error;
  }
  if (!isActive()) {
    await subscription.unsubscribe();
    return null;
  }
  return {
    ensure: async () => {
      await subscription.ensure();
      if (isActive()) {
        latestDay = Math.max(
          latestDay,
          Math.floor(Date.now() / 1000 / HYPERLIQUID_DAY_SECONDS) *
            HYPERLIQUID_DAY_SECONDS,
        );
        await refreshPromise;
        refreshedThroughDay = -1;
        await refresh();
      }
    },
    unsubscribe: async () => {
      closed = true;
      days.clear();
      await subscription.unsubscribe();
    },
  };
}

export function createTradingViewNativeHyperliquidDataProvider(
  source: IHyperliquidSource,
): ITradingViewNativeDataProvider {
  return {
    // Leave room for complete boundary weeks/months within HL's 5000 daily bars.
    getHistoryRequestCandleCount: ({ hyperliquidValue }) => {
      if (hyperliquidValue === '1w') {
        return 500;
      }
      if (hyperliquidValue === '1M') {
        return 100;
      }
      return HYPERLIQUID_HISTORY_BATCH_SIZE;
    },
    hasMoreHistory: ({ interval, receivedPointCount }) =>
      isHyperliquidCalendarInterval(interval.hyperliquidValue)
        ? receivedPointCount > 0
        : receivedPointCount >= HYPERLIQUID_HISTORY_BATCH_SIZE,
    isReady: Boolean(source.coin),
    key: getTradingViewNativeSourceKey(source),
    supportsRealtime: true,
    fetchHistory: async ({ interval, signal, timeFrom, timeTo }) => {
      const calendarInterval = interval.hyperliquidValue;
      if (!isHyperliquidCalendarInterval(calendarInterval)) {
        return tradingViewNativeHyperliquidGateway.fetchCandles({
          coin: source.coin,
          environment: source.environment,
          interval: calendarInterval,
          signal,
          timeFrom,
          timeTo,
        });
      }
      const response = await tradingViewNativeHyperliquidGateway.fetchCandles({
        coin: source.coin,
        environment: source.environment,
        interval: '1d',
        signal,
        timeFrom: getHyperliquidCalendarBucketStart(timeFrom, calendarInterval),
        timeTo: Math.min(
          getHyperliquidCalendarBucketEnd(timeTo, calendarInterval),
          Math.floor(Date.now() / 1000),
        ),
      });
      const points = aggregateHyperliquidCalendarCandles(
        response.points,
        calendarInterval,
      );
      return { points, total: points.length };
    },
    subscribeRealtime: ({ interval, onPoint, signal, subscriberId }) => {
      if (signal.aborted) {
        return Promise.resolve(null);
      }
      return isHyperliquidCalendarInterval(interval.hyperliquidValue)
        ? subscribeCalendarCandles({
            source,
            interval,
            calendarInterval: interval.hyperliquidValue,
            onPoint,
            signal,
            subscriberId,
          })
        : tradingViewNativeHyperliquidGateway.subscribeCandle({
            coin: source.coin,
            environment: source.environment,
            interval: interval.hyperliquidValue,
            listener: onPoint,
            subscriberId,
          });
    },
  };
}
