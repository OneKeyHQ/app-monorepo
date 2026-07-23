import type {
  IMarketTokenKLineDataPoint,
  IMarketTokenKLineResponse,
} from '@onekeyhq/shared/types/marketV2';

const MARKET_KLINE_MAX_PARALLEL_RANGES = 3;
const MARKET_KLINE_MIN_REMOTE_PAGE_CAPACITY = 200;
const MARKET_KLINE_SPARSE_RANGE_BUFFER = 1.25;
const MARKET_KLINE_RANGE_EXPANSION_FACTOR = 4;

export const MARKET_KLINE_MAX_HISTORY_RANGE_SECONDS = 5 * 365 * 24 * 60 * 60;

interface IMarketKlineRange {
  timeFrom: number;
  timeTo: number;
}

interface IFetchMarketKlineBackfillParams {
  targetCount: number;
  stopAfterCount: number;
  intervalSeconds: number;
  requestTimeFrom: number;
  requestTimeTo: number;
  historyFloor: number;
  fetchPage: (range: IMarketKlineRange) => Promise<IMarketTokenKLineResponse>;
  isCancelled: () => boolean;
}

export function getMarketKlineHistoryFloor({
  requestTimeTo,
  historyStartTime,
}: {
  requestTimeTo: number;
  historyStartTime?: number;
}) {
  return (
    historyStartTime ??
    Math.max(0, requestTimeTo - MARKET_KLINE_MAX_HISTORY_RANGE_SECONDS)
  );
}

export function normalizeMarketKlinePoints(
  points: IMarketTokenKLineDataPoint[],
  timeFrom: number,
  timeTo: number,
) {
  const pointsByTimestamp = new Map<number, IMarketTokenKLineDataPoint>();
  for (const point of points) {
    if (Number.isFinite(point.t) && point.t >= timeFrom && point.t < timeTo) {
      pointsByTimestamp.set(point.t, point);
    }
  }
  return Array.from(pointsByTimestamp.values()).toSorted((a, b) => a.t - b.t);
}

function buildMarketKlineRangeWave({
  pageToExclusive,
  pageSpan,
  historyFloor,
  maxRanges,
}: {
  pageToExclusive: number;
  pageSpan: number;
  historyFloor: number;
  maxRanges: number;
}) {
  const ranges: IMarketKlineRange[] = [];
  let rangeTo = pageToExclusive;
  let rangeSpan = Math.max(1, Math.floor(pageSpan));

  for (
    let rangeIndex = 0;
    rangeIndex < maxRanges && rangeTo > historyFloor;
    rangeIndex += 1
  ) {
    const rangeFrom = Math.max(historyFloor, rangeTo - rangeSpan);
    ranges.push({ timeFrom: rangeFrom, timeTo: rangeTo });
    if (rangeFrom <= historyFloor) {
      break;
    }
    rangeTo = rangeFrom;
    rangeSpan = Math.min(
      Number.MAX_SAFE_INTEGER,
      rangeSpan * MARKET_KLINE_RANGE_EXPANSION_FACTOR,
    );
  }

  return ranges;
}

export async function fetchMarketKlineBackfill({
  targetCount,
  stopAfterCount,
  intervalSeconds,
  requestTimeFrom,
  requestTimeTo,
  historyFloor,
  fetchPage,
  isCancelled,
}: IFetchMarketKlineBackfillParams): Promise<IMarketTokenKLineResponse> {
  const pointsByTimestamp = new Map<number, IMarketTokenKLineDataPoint>();
  const normalizedIntervalSeconds = Math.max(1, Math.floor(intervalSeconds));
  const maxRangesPerWave =
    stopAfterCount < targetCount ? 1 : MARKET_KLINE_MAX_PARALLEL_RANGES;
  let pageSpan = Math.max(
    normalizedIntervalSeconds * targetCount,
    requestTimeTo - Math.min(requestTimeTo, requestTimeFrom),
  );
  let pageToExclusive = requestTimeTo;
  let coveredFrom = requestTimeTo;
  let reachedHistoryFloor = false;
  let cancelled = isCancelled();

  while (
    !cancelled &&
    pointsByTimestamp.size < stopAfterCount &&
    pageToExclusive > historyFloor
  ) {
    const ranges = buildMarketKlineRangeWave({
      pageToExclusive,
      pageSpan,
      historyFloor,
      maxRanges: maxRangesPerWave,
    });
    if (ranges.length === 0) {
      break;
    }

    const pageResults = await Promise.all(
      ranges.map((range) => fetchPage(range)),
    );
    cancelled = isCancelled();
    if (cancelled) {
      break;
    }

    let nextPageToExclusive = pageToExclusive;
    let verifiedSecondsInWave = 0;
    let newPointCountInWave = 0;
    let processedRangeCount = 0;
    let largestRangeSpan = normalizedIntervalSeconds;

    for (let rangeIndex = 0; rangeIndex < ranges.length; rangeIndex += 1) {
      const range = ranges[rangeIndex];
      const pagePoints = normalizeMarketKlinePoints(
        pageResults[rangeIndex].points,
        range.timeFrom,
        range.timeTo,
      );
      const previousPointCount = pointsByTimestamp.size;
      for (const point of pagePoints) {
        pointsByTimestamp.set(point.t, point);
      }
      newPointCountInWave += pointsByTimestamp.size - previousPointCount;
      processedRangeCount += 1;
      largestRangeSpan = Math.max(
        largestRangeSpan,
        range.timeTo - range.timeFrom,
      );

      const mayBeTruncated =
        pageResults[rangeIndex].points.length >=
        MARKET_KLINE_MIN_REMOTE_PAGE_CAPACITY;
      if (mayBeTruncated) {
        const oldestReturnedTime = pagePoints[0]?.t;
        if (
          oldestReturnedTime === undefined ||
          oldestReturnedTime >= range.timeTo
        ) {
          nextPageToExclusive = pageToExclusive;
          break;
        }

        // A saturated response cannot prove that its requested start was
        // covered. Only advance to the oldest actual bar; the next wave will
        // overlap and verify the unproven part instead of skipping history.
        nextPageToExclusive = oldestReturnedTime;
        coveredFrom = Math.min(coveredFrom, oldestReturnedTime);
        verifiedSecondsInWave += range.timeTo - oldestReturnedTime;
        break;
      }

      // The smallest known endpoint cap is 200 bars. A response below that
      // limit proves this complete half-open range was not truncated, so
      // adjacent sparse ranges can be committed together safely.
      nextPageToExclusive = range.timeFrom;
      coveredFrom = Math.min(coveredFrom, range.timeFrom);
      verifiedSecondsInWave += range.timeTo - range.timeFrom;

      if (
        pointsByTimestamp.size >= stopAfterCount ||
        range.timeFrom <= historyFloor
      ) {
        reachedHistoryFloor = range.timeFrom <= historyFloor;
        break;
      }
    }

    if (
      pointsByTimestamp.size >= stopAfterCount ||
      reachedHistoryFloor ||
      processedRangeCount === 0
    ) {
      break;
    }
    if (
      nextPageToExclusive >= pageToExclusive ||
      nextPageToExclusive <= historyFloor
    ) {
      reachedHistoryFloor = nextPageToExclusive <= historyFloor;
      break;
    }

    const missingCount = Math.max(1, targetCount - pointsByTimestamp.size);
    if (newPointCountInWave > 0) {
      pageSpan = Math.max(
        normalizedIntervalSeconds * missingCount,
        Math.ceil(
          (Math.max(normalizedIntervalSeconds, verifiedSecondsInWave) /
            newPointCountInWave) *
            missingCount *
            MARKET_KLINE_SPARSE_RANGE_BUFFER,
        ),
      );
    } else {
      pageSpan = Math.max(
        normalizedIntervalSeconds * missingCount,
        largestRangeSpan * MARKET_KLINE_RANGE_EXPANSION_FACTOR,
      );
    }
    pageToExclusive = nextPageToExclusive;
  }

  const allPoints = Array.from(pointsByTimestamp.values()).toSorted(
    (a, b) => a.t - b.t,
  );
  return {
    points: allPoints,
    total: allPoints.length,
    historyMeta: {
      noData: !cancelled && reachedHistoryFloor,
      isPartial:
        cancelled || (!reachedHistoryFloor && allPoints.length < targetCount),
      ...(cancelled ? { cancelled: true } : {}),
      requestedCount: targetCount,
      returnedCount: allPoints.length,
      coveredFrom,
      coveredTo: requestTimeTo,
    },
  };
}
