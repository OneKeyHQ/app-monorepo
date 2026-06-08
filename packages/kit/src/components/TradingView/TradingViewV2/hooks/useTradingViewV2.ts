import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IMarketTokenKLineDataPoint,
  IMarketTokenKLineResponse,
} from '@onekeyhq/shared/types/marketV2';

import { sliceRequest } from '../sliceRequest';

const MIN_TRADING_VIEW_KLINE_TIME_SPAN_SECONDS = 2 * 24 * 60 * 60;

export type ITradingViewV2KLineDataFallback = (params: {
  tokenAddress: string;
  networkId: string;
  interval: string;
  timeFrom: number;
  timeTo: number;
}) => Promise<IMarketTokenKLineResponse | null | undefined>;

interface IFetchKLineDataFallbackParams {
  tokenAddress: string;
  networkId: string;
  interval: string;
  timeFrom: number;
  timeTo: number;
  kLineDataFallback?: ITradingViewV2KLineDataFallback;
}

interface ITradingViewV2Params {
  tokenAddress: string;
  networkId: string;
  interval: string;
  timeFrom: number;
  timeTo: number;
  autoHandleError?: boolean;
  kLineDataFallback?: ITradingViewV2KLineDataFallback;
  primaryKLineDataUnavailable?: boolean;
  onPrimaryKLineDataUnavailable?: () => void;
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

function hasKLinePoints(data?: IMarketTokenKLineResponse | null) {
  return Boolean(data?.points?.length);
}

function hasValidKLineResponse(
  data?: IMarketTokenKLineResponse | null,
): data is IMarketTokenKLineResponse {
  return Array.isArray(data?.points);
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
  tokenAddress,
  networkId,
  interval,
  timeFrom,
  timeTo,
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

export async function fetchTradingViewV2DataWithSlicing({
  tokenAddress,
  networkId,
  interval,
  timeFrom,
  timeTo,
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
    console.error('Failed to fetch sliced kline data:', error);
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
