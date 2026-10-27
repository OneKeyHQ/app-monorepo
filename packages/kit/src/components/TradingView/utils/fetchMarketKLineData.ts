import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { promiseAllSettledSlidingWindow } from '@onekeyhq/shared/src/utils/promiseAllSettledSlidingWindow';
import { PROMISE_CONCURRENCY_LIMIT } from '@onekeyhq/shared/src/utils/promiseUtils';
import type {
  IMarketTokenKLineDataPoint,
  IMarketTokenKLineResponse,
} from '@onekeyhq/shared/types/marketV2';

import { sliceKLineRequest } from './sliceKLineRequest';

const MIN_KLINE_TIME_SPAN_SECONDS = 2 * 24 * 60 * 60;
// The market K-line endpoint caps wide responses near 300 points.
const MARKET_KLINE_MAX_POINTS_PER_REQUEST = 200;
const MARKET_KLINE_MAX_REQUEST_COUNT = 100;
const EXCLUSIVE_LOWER_BOUNDARY_PADDING_SECONDS = 1;

type IRuntimeKLineDataPoint = Partial<
  Record<keyof IMarketTokenKLineDataPoint, unknown>
>;

interface INormalizedKLineValues {
  c: number;
  h?: number;
  l?: number;
  o?: number;
  pointType: IMarketKLinePointType;
  t: number;
  v?: number;
}

export type IMarketKLinePointType = 'ohlc' | 'single';

export interface IMarketKLineDataResponse extends IMarketTokenKLineResponse {
  pointType?: IMarketKLinePointType;
}

export type IMarketKLineDataFallback = (params: {
  tokenAddress: string;
  networkId: string;
  interval: string;
  timeFrom: number;
  timeTo: number;
}) => Promise<IMarketKLineDataResponse | null | undefined>;

interface IFetchKLineDataFallbackParams {
  tokenAddress: string;
  networkId: string;
  interval: string;
  timeFrom: number;
  timeTo: number;
  kLineDataFallback?: IMarketKLineDataFallback;
  onFallbackKLineData?: () => void;
}

export interface IFetchMarketKLineDataParams {
  tokenAddress: string;
  networkId: string;
  interval: string;
  timeFrom: number;
  timeTo: number;
  autoHandleError?: boolean;
  kLineDataFallback?: IMarketKLineDataFallback;
  onPointType?: (pointType: IMarketKLinePointType) => void;
  primaryKLineDataUnavailable?: boolean;
  onFallbackKLineData?: () => void;
  onPrimaryKLineDataUnavailable?: () => void;
}

function normalizeKLinePoints({
  points,
  timeFrom = Number.NEGATIVE_INFINITY,
  timeTo = Number.POSITIVE_INFINITY,
}: {
  points: IMarketTokenKLineDataPoint[];
  timeFrom?: number;
  timeTo?: number;
}): {
  pointType: IMarketKLinePointType;
  points: IMarketTokenKLineDataPoint[];
} {
  const pointsByTimestamp = new Map<number, INormalizedKLineValues>();

  for (const point of points) {
    const normalizedValues = getNormalizedKLineValues({
      point,
      timeFrom,
      timeTo,
    });
    if (normalizedValues) {
      pointsByTimestamp.set(normalizedValues.t, normalizedValues);
    }
  }

  const normalizedValues = Array.from(pointsByTimestamp.values()).toSorted(
    (a, b) => a.t - b.t,
  );
  const pointType =
    normalizedValues.length > 0 &&
    normalizedValues.every((point) => point.pointType === 'single')
      ? 'single'
      : 'ohlc';
  let previousClose: number | undefined;
  const normalizedPoints = normalizedValues.map<IMarketTokenKLineDataPoint>(
    (point) => {
      let normalizedPoint: IMarketTokenKLineDataPoint;
      if (
        point.o !== undefined &&
        point.h !== undefined &&
        point.l !== undefined
      ) {
        normalizedPoint = {
          o: point.o,
          h: point.h,
          l: point.l,
          c: point.c,
          v: point.v ?? 0,
          t: point.t,
        };
      } else {
        const open = previousClose ?? point.c;
        normalizedPoint = {
          o: open,
          h: Math.max(open, point.c),
          l: Math.min(open, point.c),
          c: point.c,
          v: point.v ?? 0,
          t: point.t,
        };
      }
      previousClose = point.c;
      return normalizedPoint;
    },
  );

  return { pointType, points: normalizedPoints };
}

function getNormalizedKLineValues({
  point,
  timeFrom,
  timeTo,
}: {
  point: IMarketTokenKLineDataPoint;
  timeFrom: number;
  timeTo: number;
}): INormalizedKLineValues | undefined {
  const runtimePoint = point as unknown as IRuntimeKLineDataPoint;
  const close = toFiniteNumber(runtimePoint.c);
  const timestamp = toFiniteNumber(runtimePoint.t);

  if (
    close === undefined ||
    timestamp === undefined ||
    timestamp < timeFrom ||
    timestamp >= timeTo
  ) {
    return undefined;
  }

  const open = toFiniteNumber(runtimePoint.o);
  const high = toFiniteNumber(runtimePoint.h);
  const low = toFiniteNumber(runtimePoint.l);
  const hasOhlValues =
    (runtimePoint.o !== undefined && runtimePoint.o !== null) ||
    (runtimePoint.h !== undefined && runtimePoint.h !== null) ||
    (runtimePoint.l !== undefined && runtimePoint.l !== null);

  if (
    hasOhlValues &&
    (open === undefined ||
      high === undefined ||
      low === undefined ||
      high < low)
  ) {
    return undefined;
  }

  return {
    c: close,
    h: high,
    l: low,
    o: open,
    pointType: hasOhlValues ? 'ohlc' : 'single',
    t: timestamp,
    v: toFiniteNumber(runtimePoint.v),
  };
}

function toFiniteNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function hasKLinePoints(data?: IMarketTokenKLineResponse | null) {
  return Boolean(data?.points?.length);
}

function hasValidKLineResponse(
  data?: IMarketKLineDataResponse | null,
): data is IMarketKLineDataResponse {
  return Array.isArray(data?.points);
}

function hasValidKLineSliceRequestResult(
  result: PromiseSettledResult<IMarketKLineDataResponse | null> | null,
): result is PromiseFulfilledResult<IMarketKLineDataResponse> {
  return result?.status === 'fulfilled' && hasValidKLineResponse(result.value);
}

function normalizeKLineResponse(
  data?: IMarketKLineDataResponse | null,
): IMarketKLineDataResponse | null {
  if (!hasValidKLineResponse(data)) {
    return null;
  }
  const normalizedData = normalizeKLinePoints({ points: data.points });
  const pointType =
    data.pointType === 'single' || data.pointType === 'ohlc'
      ? data.pointType
      : normalizedData.pointType;
  return {
    ...data,
    pointType,
    points: normalizedData.points,
    total: normalizedData.points.length,
  };
}

function finalizeKLineResponse(
  data: IMarketKLineDataResponse | null,
  onPointType?: (pointType: IMarketKLinePointType) => void,
): IMarketTokenKLineResponse | null {
  if (!data) {
    return null;
  }
  const { pointType = 'ohlc', ...response } = data;
  onPointType?.(pointType);
  return response;
}

async function fetchKLineDataFallback({
  tokenAddress,
  networkId,
  interval,
  timeFrom,
  timeTo,
  kLineDataFallback,
  onFallbackKLineData,
}: IFetchKLineDataFallbackParams): Promise<IMarketKLineDataResponse | null> {
  if (!kLineDataFallback) {
    return null;
  }

  try {
    const fallbackData = normalizeKLineResponse(
      await kLineDataFallback({
        tokenAddress,
        networkId,
        interval,
        timeFrom,
        timeTo,
      }),
    );
    if (hasKLinePoints(fallbackData)) {
      onFallbackKLineData?.();
    }
    return fallbackData;
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
  onFallbackKLineData,
  onPrimaryKLineDataUnavailable,
}: IFetchKLineDataFallbackParams & {
  data?: IMarketKLineDataResponse | null;
  onPrimaryKLineDataUnavailable?: () => void;
}): Promise<IMarketKLineDataResponse | null> {
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
    onFallbackKLineData,
  });
  if (!hasValidKLineResponse(data) && hasKLinePoints(fallbackData)) {
    onPrimaryKLineDataUnavailable?.();
  }
  return fallbackData ?? (hasValidKLineResponse(data) ? data : null);
}

export async function fetchMarketKLineData({
  tokenAddress,
  networkId,
  interval,
  timeFrom,
  timeTo,
  autoHandleError,
  kLineDataFallback,
  onPointType,
  primaryKLineDataUnavailable,
  onFallbackKLineData,
  onPrimaryKLineDataUnavailable,
}: IFetchMarketKLineDataParams): Promise<IMarketTokenKLineResponse | null> {
  if (primaryKLineDataUnavailable) {
    return finalizeKLineResponse(
      await fetchKLineDataFallback({
        tokenAddress,
        networkId,
        interval,
        timeFrom,
        timeTo,
        kLineDataFallback,
        onFallbackKLineData,
      }),
      onPointType,
    );
  }

  try {
    const data = normalizeKLineResponse(
      await backgroundApiProxy.serviceMarketV2.fetchMarketTokenKline({
        tokenAddress,
        networkId,
        interval,
        timeFrom,
        timeTo,
        autoHandleError,
      }),
    );

    return finalizeKLineResponse(
      await fetchFallbackIfNeeded({
        data,
        tokenAddress,
        networkId,
        interval,
        timeFrom,
        timeTo,
        kLineDataFallback,
        onFallbackKLineData,
        onPrimaryKLineDataUnavailable,
      }),
      onPointType,
    );
  } catch (error) {
    console.error('Failed to fetch kline data:', error);
    return finalizeKLineResponse(
      await fetchKLineDataFallback({
        tokenAddress,
        networkId,
        interval,
        timeFrom,
        timeTo,
        kLineDataFallback,
        onFallbackKLineData,
      }),
      onPointType,
    );
  }
}

export async function fetchMarketKLineDataWithSlicing({
  tokenAddress,
  networkId,
  interval,
  timeFrom,
  timeTo,
  autoHandleError,
  kLineDataFallback,
  onPointType,
  primaryKLineDataUnavailable,
  onFallbackKLineData,
  onPrimaryKLineDataUnavailable,
}: IFetchMarketKLineDataParams): Promise<IMarketTokenKLineResponse | null> {
  if (primaryKLineDataUnavailable) {
    return finalizeKLineResponse(
      await fetchKLineDataFallback({
        tokenAddress,
        networkId,
        interval,
        timeFrom,
        timeTo,
        kLineDataFallback,
        onFallbackKLineData,
      }),
      onPointType,
    );
  }

  try {
    const isNativeToken = !tokenAddress;
    const slices = sliceKLineRequest(interval, timeFrom, timeTo, {
      isNativeToken,
      ...(!isNativeToken
        ? { maxDataLength: MARKET_KLINE_MAX_POINTS_PER_REQUEST }
        : {}),
      maxSliceCount: MARKET_KLINE_MAX_REQUEST_COUNT,
      minTimeSpanSeconds: isNativeToken
        ? undefined
        : MIN_KLINE_TIME_SPAN_SECONDS,
    });
    const requestFactories = slices.map(
      (slice, index) =>
        async (): Promise<
          PromiseSettledResult<IMarketKLineDataResponse | null>
        > => {
          try {
            return {
              status: 'fulfilled',
              value:
                await backgroundApiProxy.serviceMarketV2.fetchMarketTokenKline({
                  tokenAddress,
                  networkId,
                  interval: slice.interval,
                  // The endpoint excludes timeFrom. Internal boundaries are
                  // covered by slice overlap; pad the first boundary by one second.
                  timeFrom:
                    index === 0
                      ? slice.from - EXCLUSIVE_LOWER_BOUNDARY_PADDING_SECONDS
                      : slice.from,
                  timeTo: slice.to,
                  autoHandleError,
                }),
            };
          } catch (reason) {
            return { status: 'rejected', reason };
          }
        },
    );
    const requestResults = await promiseAllSettledSlidingWindow(
      requestFactories,
      { concurrency: PROMISE_CONCURRENCY_LIMIT },
    );
    const failedRequests = requestResults.flatMap((result, index) => {
      const requestFactory = requestFactories[index];
      return !hasValidKLineSliceRequestResult(result)
        ? [{ index, requestFactory }]
        : [];
    });
    const remainingRequestCount = Math.max(
      0,
      MARKET_KLINE_MAX_REQUEST_COUNT - requestFactories.length,
    );
    // Initial requests take priority; retries can only use the remaining budget.
    const retryRequests = failedRequests.slice(0, remainingRequestCount);

    if (retryRequests.length > 0) {
      const retryResults = await promiseAllSettledSlidingWindow(
        retryRequests.map(({ requestFactory }) => requestFactory),
        { concurrency: PROMISE_CONCURRENCY_LIMIT },
      );
      retryRequests.forEach(({ index }, retryIndex) => {
        const retryResult = retryResults[retryIndex];
        if (retryResult) {
          requestResults[index] = retryResult;
        }
      });
    }

    const rejectedResult = requestResults.find(
      (result): result is PromiseRejectedResult =>
        result?.status === 'rejected',
    );
    if (rejectedResult) {
      throw rejectedResult.reason;
    }

    const validDataResults = requestResults
      .filter(hasValidKLineSliceRequestResult)
      .map((result) => result.value);

    if (validDataResults.length !== slices.length) {
      return finalizeKLineResponse(
        await fetchFallbackIfNeeded({
          data: null,
          tokenAddress,
          networkId,
          interval,
          timeFrom,
          timeTo,
          kLineDataFallback,
          onFallbackKLineData,
          onPrimaryKLineDataUnavailable,
        }),
        onPointType,
      );
    }

    let mergedData: IMarketKLineDataResponse | null = null;
    const mergedPoints: IMarketTokenKLineDataPoint[] = [];

    for (const data of validDataResults) {
      mergedData ??= { ...data };
      mergedPoints.push(...data.points);
    }

    if (mergedData) {
      const normalizedData = normalizeKLinePoints({
        points: mergedPoints,
        timeFrom,
        timeTo,
      });
      mergedData = {
        ...mergedData,
        pointType: normalizedData.pointType,
        points: normalizedData.points,
        total: normalizedData.points.length,
      };
    }

    return finalizeKLineResponse(
      await fetchFallbackIfNeeded({
        data: mergedData,
        tokenAddress,
        networkId,
        interval,
        timeFrom,
        timeTo,
        kLineDataFallback,
        onFallbackKLineData,
        onPrimaryKLineDataUnavailable,
      }),
      onPointType,
    );
  } catch (error) {
    console.error('Failed to fetch sliced kline data:', error);
    return finalizeKLineResponse(
      await fetchKLineDataFallback({
        tokenAddress,
        networkId,
        interval,
        timeFrom,
        timeTo,
        kLineDataFallback,
        onFallbackKLineData,
      }),
      onPointType,
    );
  }
}
