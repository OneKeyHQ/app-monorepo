import type {
  IMarketTokenKLineDataPoint,
  IMarketTokenKLineResponse,
} from '@onekeyhq/shared/types/marketV2';

import {
  MARKET_KLINE_MAX_BACKFILL_REQUESTS,
  fetchMarketKlineBackfill,
  getMarketKlineHistoryFloor,
} from './marketKlineBackfill';

function buildPoint(timestamp: number): IMarketTokenKLineDataPoint {
  return {
    t: timestamp,
    o: timestamp,
    h: timestamp,
    l: timestamp,
    c: timestamp,
    v: 1,
  };
}

function buildResponse(timestamps: number[]): IMarketTokenKLineResponse {
  return {
    points: timestamps.map(buildPoint),
    total: timestamps.length,
  };
}

describe('fetchMarketKlineBackfill', () => {
  test('keeps the initial bootstrap request single-page and safely bounded', async () => {
    const requestedRanges: Array<{ timeFrom: number; timeTo: number }> = [];

    const result = await fetchMarketKlineBackfill({
      targetCount: 300,
      stopAfterCount: 1,
      intervalSeconds: 1,
      requestTimeFrom: 700,
      requestTimeTo: 1000,
      historyFloor: 0,
      fetchPage: async (range) => {
        requestedRanges.push(range);
        return buildResponse([999]);
      },
      isCancelled: () => false,
    });

    expect(requestedRanges).toEqual([{ timeFrom: 800, timeTo: 1000 }]);
    expect(result.points.map((point) => point.t)).toEqual([999]);
    expect(result.historyMeta).toMatchObject({
      noData: false,
      isPartial: true,
      requestedCount: 300,
      returnedCount: 1,
    });
  });

  test('verifies adjacent sparse ranges in one parallel wave', async () => {
    let activeRequestCount = 0;
    let maxActiveRequestCount = 0;
    const requestedRanges: Array<{ timeFrom: number; timeTo: number }> = [];

    const result = await fetchMarketKlineBackfill({
      targetCount: 10,
      stopAfterCount: 10,
      intervalSeconds: 1,
      requestTimeFrom: 990,
      requestTimeTo: 1000,
      historyFloor: 790,
      fetchPage: async (range) => {
        requestedRanges.push(range);
        activeRequestCount += 1;
        maxActiveRequestCount = Math.max(
          maxActiveRequestCount,
          activeRequestCount,
        );
        await Promise.resolve();
        activeRequestCount -= 1;

        if (range.timeTo === 1000) {
          return buildResponse([999]);
        }
        if (range.timeTo === 990) {
          return buildResponse([980]);
        }
        return buildResponse([900]);
      },
      isCancelled: () => false,
    });

    expect(requestedRanges).toEqual([
      { timeFrom: 990, timeTo: 1000 },
      { timeFrom: 950, timeTo: 990 },
      { timeFrom: 790, timeTo: 950 },
    ]);
    expect(maxActiveRequestCount).toBe(3);
    expect(result.points.map((point) => point.t)).toEqual([900, 980, 999]);
    expect(result.historyMeta).toMatchObject({
      noData: true,
      isPartial: false,
      coveredFrom: 790,
      coveredTo: 1000,
    });
  });

  test('overlaps from the oldest actual bar when a range may be truncated', async () => {
    const requestedRanges: Array<{ timeFrom: number; timeTo: number }> = [];
    const firstSaturatedPage = [
      ...Array.from({ length: 199 }, (_, index) => 800 + index),
      // The endpoint may include the upper boundary. Saturation must use the
      // raw response count even though normalization excludes this point.
      1000,
    ];

    const result = await fetchMarketKlineBackfill({
      targetCount: 249,
      stopAfterCount: 249,
      intervalSeconds: 1,
      requestTimeFrom: 751,
      requestTimeTo: 1000,
      historyFloor: 0,
      fetchPage: async (range) => {
        requestedRanges.push(range);
        if (range.timeTo === 1000) {
          return buildResponse(firstSaturatedPage);
        }
        if (range.timeTo === 800) {
          return buildResponse(
            Array.from({ length: 50 }, (_, index) => 750 + index),
          );
        }
        return buildResponse([100]);
      },
      isCancelled: () => false,
    });

    expect(
      requestedRanges.some(
        (range) => range.timeTo === 800 && range.timeFrom < 750,
      ),
    ).toBe(true);
    expect(result.points).toHaveLength(249);
    expect(result.points[0].t).toBe(750);
    expect(result.points.at(-1)?.t).toBe(998);
    expect(result.points.some((point) => point.t === 100)).toBe(false);
  });

  test('deduplicates boundaries and sorts out-of-order parallel responses', async () => {
    const result = await fetchMarketKlineBackfill({
      targetCount: 10,
      stopAfterCount: 10,
      intervalSeconds: 1,
      requestTimeFrom: 990,
      requestTimeTo: 1000,
      historyFloor: 790,
      fetchPage: async (range) => {
        if (range.timeTo === 1000) {
          await Promise.resolve();
          await Promise.resolve();
          return buildResponse([999, 990, 999]);
        }
        if (range.timeTo === 990) {
          return buildResponse([989, 980, 990]);
        }
        await Promise.resolve();
        return buildResponse([900, 980]);
      },
      isCancelled: () => false,
    });

    expect(result.points.map((point) => point.t)).toEqual([
      900, 980, 989, 990, 999,
    ]);
  });

  test('does not skip sparse data when the endpoint silently caps time slots', async () => {
    const requestedRanges: Array<{ timeFrom: number; timeTo: number }> = [];
    const endpointSlotCapacity = 200;
    const availableTimestamps = [150, 350, 550, 750, 850, 950];

    const result = await fetchMarketKlineBackfill({
      targetCount: 10,
      stopAfterCount: 10,
      intervalSeconds: 1,
      requestTimeFrom: 990,
      requestTimeTo: 1000,
      historyFloor: 0,
      fetchPage: async (range) => {
        requestedRanges.push(range);
        const effectiveTimeFrom = Math.max(
          range.timeFrom,
          range.timeTo - endpointSlotCapacity,
        );
        return buildResponse(
          availableTimestamps.filter(
            (timestamp) =>
              timestamp >= effectiveTimeFrom && timestamp < range.timeTo,
          ),
        );
      },
      isCancelled: () => false,
    });

    expect(
      requestedRanges.every(
        (range) => range.timeTo - range.timeFrom <= endpointSlotCapacity,
      ),
    ).toBe(true);
    expect(result.points.map((point) => point.t)).toEqual(availableTimestamps);
    expect(result.historyMeta).toMatchObject({
      noData: true,
      isPartial: false,
      coveredFrom: 0,
      coveredTo: 1000,
    });
  });

  test.each([
    { label: 'daily', intervalSeconds: 24 * 60 * 60 },
    { label: 'weekly', intervalSeconds: 7 * 24 * 60 * 60 },
  ])(
    'can reach 2000 $label candles without an artificial five-year floor',
    async ({ intervalSeconds }) => {
      const targetCount = 2000;
      const requestTimeTo = intervalSeconds * 2500;
      const result = await fetchMarketKlineBackfill({
        targetCount,
        stopAfterCount: targetCount,
        intervalSeconds,
        requestTimeFrom: requestTimeTo - intervalSeconds * targetCount,
        requestTimeTo,
        historyFloor: getMarketKlineHistoryFloor({}),
        fetchPage: async ({ timeFrom, timeTo }) =>
          buildResponse(
            Array.from(
              { length: Math.floor((timeTo - timeFrom) / intervalSeconds) },
              (_, index) => timeFrom + index * intervalSeconds,
            ),
          ),
        isCancelled: () => false,
      });

      expect(result.points).toHaveLength(targetCount);
      expect(result.historyMeta).toMatchObject({
        noData: false,
        isPartial: false,
        stopReason: 'target_reached',
      });
    },
  );

  test('fills the requested count across sparse capped ranges without ending history', async () => {
    const requestedRanges: Array<{ timeFrom: number; timeTo: number }> = [];
    const endpointSlotCapacity = 200;
    const availableTimestamps = [150, 350, 550, 750, 950];

    const result = await fetchMarketKlineBackfill({
      targetCount: 4,
      stopAfterCount: 4,
      intervalSeconds: 1,
      requestTimeFrom: 996,
      requestTimeTo: 1000,
      historyFloor: 0,
      fetchPage: async (range) => {
        requestedRanges.push(range);
        const effectiveTimeFrom = Math.max(
          range.timeFrom,
          range.timeTo - endpointSlotCapacity,
        );
        return buildResponse(
          availableTimestamps.filter(
            (timestamp) =>
              timestamp >= effectiveTimeFrom && timestamp < range.timeTo,
          ),
        );
      },
      isCancelled: () => false,
    });

    expect(
      requestedRanges.every(
        (range) => range.timeTo - range.timeFrom <= endpointSlotCapacity,
      ),
    ).toBe(true);
    expect(result.points.map((point) => point.t)).toEqual([350, 550, 750, 950]);
    expect(result.historyMeta).toMatchObject({
      noData: false,
      isPartial: false,
      requestedCount: 4,
      returnedCount: 4,
      coveredTo: 1000,
    });
  });

  test('does not start another wave after cancellation', async () => {
    let cancelled = false;
    let requestCount = 0;

    const result = await fetchMarketKlineBackfill({
      targetCount: 10,
      stopAfterCount: 10,
      intervalSeconds: 1,
      requestTimeFrom: 990,
      requestTimeTo: 1000,
      historyFloor: 0,
      fetchPage: async () => {
        requestCount += 1;
        if (requestCount === 3) {
          cancelled = true;
        }
        return buildResponse([]);
      },
      isCancelled: () => cancelled,
    });

    expect(requestCount).toBe(3);
    expect(result.historyMeta).toMatchObject({
      noData: false,
      isPartial: true,
      cancelled: true,
    });
  });

  test('treats the request budget as terminal for extremely sparse history', async () => {
    let requestCount = 0;

    const result = await fetchMarketKlineBackfill({
      targetCount: 299,
      stopAfterCount: 299,
      intervalSeconds: 1,
      requestTimeFrom: 99_701,
      requestTimeTo: 100_000,
      historyFloor: 0,
      fetchPage: async () => {
        requestCount += 1;
        return buildResponse([]);
      },
      isCancelled: () => false,
    });

    expect(requestCount).toBe(MARKET_KLINE_MAX_BACKFILL_REQUESTS);
    expect(result.points).toEqual([]);
    expect(result.historyMeta).toMatchObject({
      noData: true,
      isPartial: false,
      stopReason: 'page_budget_exhausted',
      requestedCount: 299,
      returnedCount: 0,
      coveredTo: 100_000,
    });
  });
});

describe('getMarketKlineHistoryFloor', () => {
  test('uses the token history start when available', () => {
    expect(
      getMarketKlineHistoryFloor({
        historyStartTime: 800,
      }),
    ).toBe(800);
  });

  test('does not treat an artificial lookback window as exhausted history', () => {
    expect(getMarketKlineHistoryFloor({})).toBe(0);
  });
});
