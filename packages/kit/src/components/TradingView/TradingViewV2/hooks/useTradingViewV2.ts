import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IMarketTokenKLineDataPoint,
  IMarketTokenKLineResponse,
} from '@onekeyhq/shared/types/marketV2';

import { sliceRequest } from '../sliceRequest';

const MIN_TRADING_VIEW_KLINE_TIME_SPAN_SECONDS = 2 * 24 * 60 * 60;

interface ITradingViewV2Params {
  tokenAddress: string;
  networkId: string;
  interval: string;
  timeFrom: number;
  timeTo: number;
  autoHandleError?: boolean;
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
    if (point.t >= timeFrom && point.t <= timeTo) {
      pointsByTimestamp.set(point.t, point);
    }
  }

  return Array.from(pointsByTimestamp.values()).toSorted((a, b) => a.t - b.t);
}

export async function fetchTradingViewV2Data({
  tokenAddress,
  networkId,
  interval,
  timeFrom,
  timeTo,
  autoHandleError,
}: ITradingViewV2Params): Promise<IMarketTokenKLineResponse | null> {
  try {
    const data = await backgroundApiProxy.serviceMarketV2.fetchMarketTokenKline(
      {
        tokenAddress,
        networkId,
        interval,
        timeFrom,
        timeTo,
        autoHandleError,
      },
    );

    return data ?? null;
  } catch (error) {
    console.error('Failed to fetch kline data:', error);
    return null;
  }
}

export async function fetchTradingViewV2DataWithSlicing({
  tokenAddress,
  networkId,
  interval,
  timeFrom,
  timeTo,
  autoHandleError,
}: ITradingViewV2Params): Promise<IMarketTokenKLineResponse | null> {
  try {
    // Check if the token is a native token
    // Native tokens typically have empty or undefined tokenAddress
    const isNativeToken = !tokenAddress || tokenAddress === '';

    const slices = sliceRequest(interval, timeFrom, timeTo, {
      isNativeToken,
      minTimeSpanSeconds: isNativeToken
        ? undefined
        : MIN_TRADING_VIEW_KLINE_TIME_SPAN_SECONDS,
    });

    const dataPromises = slices.map((slice) =>
      backgroundApiProxy.serviceMarketV2.fetchMarketTokenKline({
        tokenAddress,
        networkId,
        interval: slice.interval,
        timeFrom: slice.from,
        timeTo: slice.to,
        autoHandleError,
      }),
    );

    const dataResults = await Promise.all(dataPromises);

    let mergedData: IMarketTokenKLineResponse | null = null;
    const mergedPoints: IMarketTokenKLineDataPoint[] = [];

    for (const data of dataResults) {
      if (data) {
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

    return mergedData;
  } catch (error) {
    console.error('Failed to fetch sliced kline data:', error);
    return null;
  }
}
