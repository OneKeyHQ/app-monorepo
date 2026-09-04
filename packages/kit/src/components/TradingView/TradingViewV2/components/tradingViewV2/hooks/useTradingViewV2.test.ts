import { sliceKLineRequest } from '@onekeyhq/kit/src/components/TradingView/utils/sliceKLineRequest';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { PROMISE_CONCURRENCY_LIMIT } from '@onekeyhq/shared/src/utils/promiseUtils';
import type {
  IMarketTokenKLineDataPoint,
  IMarketTokenKLineResponse,
} from '@onekeyhq/shared/types/marketV2';

import { fetchTradingViewV2DataWithSlicing } from './useTradingViewV2';

type IFetchMarketTokenKline = (params: {
  tokenAddress: string;
  networkId: string;
  interval: string;
  timeFrom: number;
  timeTo: number;
}) => Promise<IMarketTokenKLineResponse | null>;

const mockFetchMarketTokenKline: jest.MockedFunction<IFetchMarketTokenKline> =
  jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketTokenKline: (params: Parameters<IFetchMarketTokenKline>[0]) =>
        mockFetchMarketTokenKline(params),
    },
  },
}));

jest.mock(
  '@onekeyhq/kit/src/components/TradingView/utils/sliceKLineRequest',
  () => ({
    sliceKLineRequest: jest.fn(),
  }),
);

const mockSliceRequest = sliceKLineRequest as jest.MockedFunction<
  typeof sliceKLineRequest
>;

function buildPoint(t: number, close = t): IMarketTokenKLineDataPoint {
  return {
    o: close,
    h: close,
    l: close,
    c: close,
    v: 0,
    t,
  };
}

describe('fetchTradingViewV2DataWithSlicing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('clips expanded slice data to the original request window and normalizes points', async () => {
    mockSliceRequest.mockReturnValue([
      { from: 900, to: 1060, interval: '1m' },
      { from: 1060, to: 1120, interval: '1m' },
    ]);

    mockFetchMarketTokenKline
      .mockResolvedValueOnce({
        points: [buildPoint(1060, 1), buildPoint(960), buildPoint(1020)],
        total: 3,
      })
      .mockResolvedValueOnce({
        points: [
          buildPoint(1200),
          buildPoint(1120),
          buildPoint(1080),
          buildPoint(1060, 2),
        ],
        total: 4,
      });

    const result = await fetchTradingViewV2DataWithSlicing({
      tokenAddress: '0x123',
      networkId: 'evm--1',
      interval: '1m',
      timeFrom: 1000,
      timeTo: 1120,
    });

    expect(mockSliceRequest).toHaveBeenCalledWith('1m', 1000, 1120, {
      isNativeToken: false,
      maxDataLength: 200,
      maxSliceCount: 100,
      minTimeSpanSeconds: 172_800,
    });
    expect(mockFetchMarketTokenKline).toHaveBeenNthCalledWith(1, {
      tokenAddress: '0x123',
      networkId: 'evm--1',
      interval: '1m',
      timeFrom: 899,
      timeTo: 1060,
      autoHandleError: undefined,
    });
    expect(mockFetchMarketTokenKline).toHaveBeenNthCalledWith(2, {
      tokenAddress: '0x123',
      networkId: 'evm--1',
      interval: '1m',
      timeFrom: 1060,
      timeTo: 1120,
      autoHandleError: undefined,
    });
    expect(result?.total).toBe(3);
    expect(result?.points.map((point) => ({ t: point.t, c: point.c }))).toEqual(
      [
        { t: 1020, c: 1020 },
        { t: 1060, c: 2 },
        { t: 1080, c: 1080 },
      ],
    );
  });

  it('includes the requested lower-bound candle for an exclusive endpoint', async () => {
    mockSliceRequest.mockReturnValue([{ from: 960, to: 1080, interval: '1m' }]);
    mockFetchMarketTokenKline.mockImplementation(
      async ({ timeFrom, timeTo }) => ({
        points: [buildPoint(960), buildPoint(1020), buildPoint(1080)].filter(
          (point) => point.t > timeFrom && point.t < timeTo,
        ),
        total: 3,
      }),
    );

    const result = await fetchTradingViewV2DataWithSlicing({
      tokenAddress: '0x123',
      networkId: 'evm--1',
      interval: '1m',
      timeFrom: 960,
      timeTo: 1080,
    });

    expect(mockFetchMarketTokenKline).toHaveBeenCalledWith(
      expect.objectContaining({ timeFrom: 959, timeTo: 1080 }),
    );
    expect(result?.points.map((point) => point.t)).toEqual([960, 1020]);
  });

  it('keeps a wide request continuous when the backend caps each response', async () => {
    const actualSliceRequest = jest.requireActual<{
      sliceKLineRequest: typeof sliceKLineRequest;
    }>(
      '@onekeyhq/kit/src/components/TradingView/utils/sliceKLineRequest',
    ).sliceKLineRequest;
    const timeFrom = 1_776_959_280;
    const timeTo = 1_782_471_600;
    const intervalSeconds = 60 * 60;

    mockSliceRequest.mockImplementation(actualSliceRequest);
    mockFetchMarketTokenKline.mockImplementation(async (params) => {
      const points: IMarketTokenKLineDataPoint[] = [];
      const firstTimestamp =
        Math.floor(params.timeFrom / intervalSeconds) * intervalSeconds +
        intervalSeconds;

      for (
        let timestamp = firstTimestamp;
        timestamp < params.timeTo;
        timestamp += intervalSeconds
      ) {
        points.push(buildPoint(timestamp));
      }

      const cappedPoints = points.slice(-299);
      return {
        points: cappedPoints,
        total: cappedPoints.length,
      };
    });

    const result = await fetchTradingViewV2DataWithSlicing({
      tokenAddress: '0x123',
      networkId: 'evm--1',
      interval: '1H',
      timeFrom,
      timeTo,
    });
    const expectedTimestamps: number[] = [];
    const firstExpectedTimestamp =
      Math.ceil(timeFrom / intervalSeconds) * intervalSeconds;

    for (
      let timestamp = firstExpectedTimestamp;
      timestamp < timeTo;
      timestamp += intervalSeconds
    ) {
      expectedTimestamps.push(timestamp);
    }

    expect(mockFetchMarketTokenKline).toHaveBeenCalledTimes(8);
    expect(result?.points.map((point) => point.t)).toEqual(expectedTimestamps);
    expect(
      result?.points.filter(
        (point) => point.t >= 1_777_564_800 && point.t < 1_777_651_200,
      ),
    ).toHaveLength(24);
  });

  it('uses fallback data when sliced primary data has no points', async () => {
    const onPrimaryKLineDataUnavailable = jest.fn();
    const fallback = jest.fn().mockResolvedValue({
      points: [buildPoint(1020, 3)],
      total: 1,
    });
    mockSliceRequest.mockReturnValue([
      { from: 1000, to: 1120, interval: '1m' },
    ]);
    mockFetchMarketTokenKline.mockResolvedValueOnce({
      points: [],
      total: 0,
    });

    const result = await fetchTradingViewV2DataWithSlicing({
      tokenAddress: '0x123',
      networkId: 'evm--1',
      interval: '1m',
      timeFrom: 1000,
      timeTo: 1120,
      kLineDataFallback: fallback,
      onPrimaryKLineDataUnavailable,
    });

    expect(onPrimaryKLineDataUnavailable).not.toHaveBeenCalled();
    expect(fallback).toHaveBeenCalledWith({
      tokenAddress: '0x123',
      networkId: 'evm--1',
      interval: '1m',
      timeFrom: 1000,
      timeTo: 1120,
    });
    expect(result?.points).toEqual([buildPoint(1020, 3)]);
  });

  it('keeps fallback available after a previous primary request returned points', async () => {
    const fallback = jest.fn().mockResolvedValue({
      points: [buildPoint(2040, 4)],
      total: 1,
    });
    mockSliceRequest.mockImplementation((interval, from, to) => [
      { from, to, interval },
    ]);
    mockFetchMarketTokenKline
      .mockResolvedValueOnce({
        points: [buildPoint(1020, 3)],
        total: 1,
      })
      .mockResolvedValueOnce({
        points: [],
        total: 0,
      });

    const primaryResult = await fetchTradingViewV2DataWithSlicing({
      tokenAddress: '0x123',
      networkId: 'evm--1',
      interval: '1m',
      timeFrom: 1000,
      timeTo: 1120,
      kLineDataFallback: fallback,
    });
    const fallbackResult = await fetchTradingViewV2DataWithSlicing({
      tokenAddress: '0x123',
      networkId: 'evm--1',
      interval: '1m',
      timeFrom: 2000,
      timeTo: 2120,
      kLineDataFallback: fallback,
    });

    expect(primaryResult?.points).toEqual([buildPoint(1020, 3)]);
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(fallback).toHaveBeenCalledWith({
      tokenAddress: '0x123',
      networkId: 'evm--1',
      interval: '1m',
      timeFrom: 2000,
      timeTo: 2120,
    });
    expect(fallbackResult?.points).toEqual([buildPoint(2040, 4)]);
  });

  it('does not return partial history when a sliced response is invalid', async () => {
    const onPrimaryKLineDataUnavailable = jest.fn();
    const fallback = jest.fn().mockResolvedValue({
      points: [buildPoint(2040, 4)],
      total: 1,
    });
    mockSliceRequest.mockReturnValue([
      { from: 2000, to: 2060, interval: '1m' },
      { from: 2060, to: 2120, interval: '1m' },
    ]);
    mockFetchMarketTokenKline.mockResolvedValue(null).mockResolvedValueOnce({
      points: [buildPoint(2040, 1)],
      total: 1,
    });

    const result = await fetchTradingViewV2DataWithSlicing({
      tokenAddress: '0x123',
      networkId: 'evm--1',
      interval: '1m',
      timeFrom: 2000,
      timeTo: 2120,
      kLineDataFallback: fallback,
      onPrimaryKLineDataUnavailable,
    });

    expect(onPrimaryKLineDataUnavailable).toHaveBeenCalledTimes(1);
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(result?.points).toEqual([buildPoint(2040, 4)]);
  });

  it('retries a failed slice and returns complete history', async () => {
    mockSliceRequest.mockReturnValue([
      { from: 1000, to: 1060, interval: '1m' },
      { from: 1060, to: 1120, interval: '1m' },
    ]);
    let firstSliceRequestCount = 0;
    mockFetchMarketTokenKline.mockImplementation(async ({ timeTo }) => {
      if (timeTo === 1060) {
        firstSliceRequestCount += 1;
        if (firstSliceRequestCount === 1) {
          throw new OneKeyLocalError('transient failure');
        }
        return { points: [buildPoint(1020, 1)], total: 1 };
      }
      return { points: [buildPoint(1080, 2)], total: 1 };
    });

    const result = await fetchTradingViewV2DataWithSlicing({
      tokenAddress: '0x123',
      networkId: 'evm--1',
      interval: '1m',
      timeFrom: 1000,
      timeTo: 1120,
    });

    expect(mockFetchMarketTokenKline).toHaveBeenCalledTimes(3);
    expect(result?.points).toEqual([buildPoint(1020, 1), buildPoint(1080, 2)]);
  });

  it('caps initial requests and retries at one hundred calls', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockSliceRequest.mockReturnValue(
      Array.from({ length: 99 }, (_, index) => ({
        from: index * 60,
        to: (index + 2) * 60,
        interval: '1m',
      })),
    );
    mockFetchMarketTokenKline.mockRejectedValue(new Error('primary failed'));

    await expect(
      fetchTradingViewV2DataWithSlicing({
        tokenAddress: '0x123',
        networkId: 'evm--1',
        interval: '1m',
        timeFrom: 0,
        timeTo: 100 * 60,
      }),
    ).resolves.toBeNull();

    expect(mockFetchMarketTokenKline).toHaveBeenCalledTimes(100);
    consoleErrorSpy.mockRestore();
  });

  it('limits concurrent sliced requests', async () => {
    const sliceCount = PROMISE_CONCURRENCY_LIMIT + 2;
    mockSliceRequest.mockReturnValue(
      Array.from({ length: sliceCount }, (_, index) => ({
        from: index * 60,
        to: (index + 2) * 60,
        interval: '1m',
      })),
    );

    let activeRequestCount = 0;
    let maxActiveRequestCount = 0;
    let requestIndex = 0;
    let releaseFirstWave: () => void = () => undefined;
    const firstWaveGate = new Promise<void>((resolve) => {
      releaseFirstWave = resolve;
    });
    mockFetchMarketTokenKline.mockImplementation(async () => {
      const currentRequestIndex = requestIndex;
      requestIndex += 1;
      activeRequestCount += 1;
      maxActiveRequestCount = Math.max(
        maxActiveRequestCount,
        activeRequestCount,
      );
      if (currentRequestIndex < PROMISE_CONCURRENCY_LIMIT) {
        await firstWaveGate;
      }
      activeRequestCount -= 1;
      return { points: [], total: 0 };
    });

    const resultPromise = fetchTradingViewV2DataWithSlicing({
      tokenAddress: '0x123',
      networkId: 'evm--1',
      interval: '1m',
      timeFrom: 0,
      timeTo: sliceCount * 60,
    });

    await Promise.resolve();
    expect(mockFetchMarketTokenKline).toHaveBeenCalledTimes(
      PROMISE_CONCURRENCY_LIMIT,
    );
    releaseFirstWave();

    await expect(resultPromise).resolves.toEqual({ points: [], total: 0 });
    expect(mockFetchMarketTokenKline).toHaveBeenCalledTimes(sliceCount);
    expect(maxActiveRequestCount).toBe(PROMISE_CONCURRENCY_LIMIT);
  });

  it('uses fallback directly when primary data is already unavailable', async () => {
    const fallback = jest.fn().mockResolvedValue({
      points: [buildPoint(2040, 4)],
      total: 1,
    });

    const result = await fetchTradingViewV2DataWithSlicing({
      tokenAddress: '0x123',
      networkId: 'evm--1',
      interval: '1m',
      timeFrom: 2000,
      timeTo: 2120,
      kLineDataFallback: fallback,
      primaryKLineDataUnavailable: true,
    });

    expect(mockSliceRequest).not.toHaveBeenCalled();
    expect(mockFetchMarketTokenKline).not.toHaveBeenCalled();
    expect(fallback).toHaveBeenCalledWith({
      tokenAddress: '0x123',
      networkId: 'evm--1',
      interval: '1m',
      timeFrom: 2000,
      timeTo: 2120,
    });
    expect(result?.points).toEqual([buildPoint(2040, 4)]);
  });

  it('uses fallback data when sliced primary data rejects', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const fallback = jest.fn().mockResolvedValue({
      points: [buildPoint(1020, 3)],
      total: 1,
    });
    mockSliceRequest.mockReturnValue([
      { from: 1000, to: 1120, interval: '1m' },
    ]);
    mockFetchMarketTokenKline.mockRejectedValueOnce(
      new Error('primary failed'),
    );

    const result = await fetchTradingViewV2DataWithSlicing({
      tokenAddress: '0x123',
      networkId: 'evm--1',
      interval: '1m',
      timeFrom: 1000,
      timeTo: 1120,
      kLineDataFallback: fallback,
    });

    expect(fallback).toHaveBeenCalledWith({
      tokenAddress: '0x123',
      networkId: 'evm--1',
      interval: '1m',
      timeFrom: 1000,
      timeTo: 1120,
    });
    expect(result?.points).toEqual([buildPoint(1020, 3)]);
    consoleErrorSpy.mockRestore();
  });
});
