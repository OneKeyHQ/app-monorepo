import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IMarketTokenKLineDataPoint,
  IMarketTokenKLineResponse,
} from '@onekeyhq/shared/types/marketV2';

import { sliceKLineRequest } from './sliceKLineRequest';

const MIN_KLINE_TIME_SPAN_SECONDS = 2 * 24 * 60 * 60;

type IRuntimeKLineDataPoint = Partial<
  Record<keyof IMarketTokenKLineDataPoint, unknown>
>;

interface INormalizedKLineValues {
  c: number;
  h?: number;
  l?: number;
  o?: number;
  t: number;
  v?: number;
}

export type IMarketKLineDataFallback = (params: {
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
}) {
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

  let previousClose: number | undefined;
  return Array.from(pointsByTimestamp.values())
    .toSorted((a, b) => a.t - b.t)
    .map<IMarketTokenKLineDataPoint>((point) => {
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
    });
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
    timestamp > timeTo
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
  data?: IMarketTokenKLineResponse | null,
): data is IMarketTokenKLineResponse {
  return Array.isArray(data?.points);
}

function normalizeKLineResponse(
  data?: IMarketTokenKLineResponse | null,
): IMarketTokenKLineResponse | null {
  if (!hasValidKLineResponse(data)) {
    return null;
  }
  const points = normalizeKLinePoints({ points: data.points });
  return { ...data, points, total: points.length };
}

async function fetchKLineDataFallback({
  tokenAddress,
  networkId,
  interval,
  timeFrom,
  timeTo,
  kLineDataFallback,
  onFallbackKLineData,
}: IFetchKLineDataFallbackParams): Promise<IMarketTokenKLineResponse | null> {
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
  primaryKLineDataUnavailable,
  onFallbackKLineData,
  onPrimaryKLineDataUnavailable,
}: IFetchMarketKLineDataParams): Promise<IMarketTokenKLineResponse | null> {
  if (primaryKLineDataUnavailable) {
    return fetchKLineDataFallback({
      tokenAddress,
      networkId,
      interval,
      timeFrom,
      timeTo,
      kLineDataFallback,
      onFallbackKLineData,
    });
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

    return await fetchFallbackIfNeeded({
      data,
      tokenAddress,
      networkId,
      interval,
      timeFrom,
      timeTo,
      kLineDataFallback,
      onFallbackKLineData,
      onPrimaryKLineDataUnavailable,
    });
  } catch (error) {
    console.error('Failed to fetch kline data:', error);
    return fetchKLineDataFallback({
      tokenAddress,
      networkId,
      interval,
      timeFrom,
      timeTo,
      kLineDataFallback,
      onFallbackKLineData,
    });
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
  primaryKLineDataUnavailable,
  onFallbackKLineData,
  onPrimaryKLineDataUnavailable,
}: IFetchMarketKLineDataParams): Promise<IMarketTokenKLineResponse | null> {
  if (primaryKLineDataUnavailable) {
    return fetchKLineDataFallback({
      tokenAddress,
      networkId,
      interval,
      timeFrom,
      timeTo,
      kLineDataFallback,
      onFallbackKLineData,
    });
  }

  try {
    const isNativeToken = !tokenAddress;
    const slices = sliceKLineRequest(interval, timeFrom, timeTo, {
      isNativeToken,
      minTimeSpanSeconds: isNativeToken
        ? undefined
        : MIN_KLINE_TIME_SPAN_SECONDS,
    });
    const dataResults = await Promise.all(
      slices.map((slice) =>
        backgroundApiProxy.serviceMarketV2.fetchMarketTokenKline({
          tokenAddress,
          networkId,
          interval: slice.interval,
          timeFrom: slice.from,
          timeTo: slice.to,
          autoHandleError,
        }),
      ),
    );

    let mergedData: IMarketTokenKLineResponse | null = null;
    const mergedPoints: IMarketTokenKLineDataPoint[] = [];

    for (const data of dataResults) {
      if (hasValidKLineResponse(data)) {
        mergedData ??= { ...data };
        mergedPoints.push(...data.points);
      }
    }

    if (mergedData) {
      const points = normalizeKLinePoints({
        points: mergedPoints,
        timeFrom,
        timeTo,
      });
      mergedData = { ...mergedData, points, total: points.length };
    }

    return await fetchFallbackIfNeeded({
      data: mergedData,
      tokenAddress,
      networkId,
      interval,
      timeFrom,
      timeTo,
      kLineDataFallback,
      onFallbackKLineData,
      onPrimaryKLineDataUnavailable,
    });
  } catch (error) {
    console.error('Failed to fetch sliced kline data:', error);
    return fetchKLineDataFallback({
      tokenAddress,
      networkId,
      interval,
      timeFrom,
      timeTo,
      kLineDataFallback,
      onFallbackKLineData,
    });
  }
}
