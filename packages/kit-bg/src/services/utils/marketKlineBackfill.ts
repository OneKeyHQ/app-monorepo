import type {
  IMarketTokenKLineDataPoint,
  IMarketTokenKLineHistoryMeta,
  IMarketTokenKLineResponse,
} from '@onekeyhq/shared/types/marketV2';

const MARKET_KLINE_MAX_PARALLEL_RANGES = 3;
const MARKET_KLINE_MIN_REMOTE_PAGE_CAPACITY = 200;
const MARKET_KLINE_SPARSE_RANGE_BUFFER = 1.25;
const MARKET_KLINE_RANGE_EXPANSION_FACTOR = 4;

export const MARKET_KLINE_MAX_BACKFILL_REQUESTS = 30;

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
  historyStartTime,
}: {
  historyStartTime?: number;
}) {
  return historyStartTime ?? 0;
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
  maxRangeSpan,
  historyFloor,
  maxRanges,
}: {
  pageToExclusive: number;
  pageSpan: number;
  maxRangeSpan: number;
  historyFloor: number;
  maxRanges: number;
}) {
  const ranges: IMarketKlineRange[] = [];
  let rangeTo = pageToExclusive;
  let rangeSpan = Math.min(maxRangeSpan, Math.max(1, Math.floor(pageSpan)));

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
      maxRangeSpan,
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
  // The remote endpoint limits time slots before removing empty candles.
  // Keep every range within the smallest known slot capacity so a sparse
  // response cannot silently hide an earlier part of the requested range.
  const maxRangeSpan =
    normalizedIntervalSeconds * MARKET_KLINE_MIN_REMOTE_PAGE_CAPACITY;
  const maxRangesPerWave =
    stopAfterCount < targetCount ? 1 : MARKET_KLINE_MAX_PARALLEL_RANGES;
  let pageSpan = Math.min(
    maxRangeSpan,
    Math.max(
      normalizedIntervalSeconds * targetCount,
      requestTimeTo - Math.min(requestTimeTo, requestTimeFrom),
    ),
  );
  let pageToExclusive = requestTimeTo;
  let coveredFrom = requestTimeTo;
  let reachedHistoryFloor = false;
  let cancelled = isCancelled();
  let requestCount = 0;

  while (
    !cancelled &&
    pointsByTimestamp.size < stopAfterCount &&
    pageToExclusive > historyFloor &&
    requestCount < MARKET_KLINE_MAX_BACKFILL_REQUESTS
  ) {
    const remainingRequestCount =
      MARKET_KLINE_MAX_BACKFILL_REQUESTS - requestCount;
    const ranges = buildMarketKlineRangeWave({
      pageToExclusive,
      pageSpan,
      maxRangeSpan,
      historyFloor,
      maxRanges: Math.min(maxRangesPerWave, remainingRequestCount),
    });
    if (ranges.length === 0) {
      break;
    }

    requestCount += ranges.length;
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

      // The range itself is bounded by the smallest known endpoint slot
      // capacity, so a response below the point cap verifies this complete
      // half-open range even when most slots contain no candle.
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
      pageSpan = Math.min(
        maxRangeSpan,
        Math.max(
          normalizedIntervalSeconds * missingCount,
          Math.ceil(
            (Math.max(normalizedIntervalSeconds, verifiedSecondsInWave) /
              newPointCountInWave) *
              missingCount *
              MARKET_KLINE_SPARSE_RANGE_BUFFER,
          ),
        ),
      );
    } else {
      pageSpan = Math.min(
        maxRangeSpan,
        Math.max(
          normalizedIntervalSeconds * missingCount,
          largestRangeSpan * MARKET_KLINE_RANGE_EXPANSION_FACTOR,
        ),
      );
    }
    pageToExclusive = nextPageToExclusive;
  }

  const allPoints = Array.from(pointsByTimestamp.values()).toSorted(
    (a, b) => a.t - b.t,
  );
  const targetReached = allPoints.length >= targetCount;
  const stopAfterCountReached = allPoints.length >= stopAfterCount;
  const requestBudgetExhausted =
    !cancelled &&
    !reachedHistoryFloor &&
    !stopAfterCountReached &&
    requestCount >= MARKET_KLINE_MAX_BACKFILL_REQUESTS;
  // Product invariant: exhausting the per-call budget terminates chart history.
  // Returning a resumable partial result would let sparse assets immediately
  // start another call with a fresh budget and effectively bypass this limit.
  const shouldTerminateChartHistory =
    reachedHistoryFloor || requestBudgetExhausted;
  const noData = !cancelled && shouldTerminateChartHistory;
  let stopReason: IMarketTokenKLineHistoryMeta['stopReason'];
  if (reachedHistoryFloor) {
    stopReason = 'history_exhausted';
  } else if (targetReached) {
    stopReason = 'target_reached';
  } else if (requestBudgetExhausted) {
    stopReason = 'page_budget_exhausted';
  }

  return {
    points: allPoints,
    total: allPoints.length,
    historyMeta: {
      noData,
      isPartial: cancelled || (!noData && !targetReached),
      ...(stopReason ? { stopReason } : {}),
      ...(cancelled ? { cancelled: true } : {}),
      requestedCount: targetCount,
      returnedCount: allPoints.length,
      coveredFrom,
      coveredTo: requestTimeTo,
    },
  };
}
