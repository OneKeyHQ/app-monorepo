import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IMarketTokenKLineDataPoint,
  IMarketTokenKLineResponse,
} from '@onekeyhq/shared/types/marketV2';

import { sliceRequest } from '../sliceRequest';

import {
  fetchTradingViewV2DataWithSlicing,
  prefetchTradingViewV2FirstScreenData,
  subscribeTradingViewV2FirstScreenPrefetch,
} from './useTradingViewV2';

type IFetchMarketTokenKline = (params: {
  tokenAddress: string;
  networkId: string;
  interval: string;
  timeFrom: number;
  timeTo: number;
}) => Promise<IMarketTokenKLineResponse | null>;

type IFetchMarketTokenKlineByCount = (
  params: Parameters<IFetchMarketTokenKline>[0] & {
    requestId?: string;
    targetCount: number;
    stopAfterCount?: number;
    historyStartTime?: number;
  },
) => Promise<IMarketTokenKLineResponse | null>;

const mockFetchMarketTokenKline: jest.MockedFunction<IFetchMarketTokenKline> =
  jest.fn();
const mockFetchMarketTokenKlineByCount: jest.MockedFunction<IFetchMarketTokenKlineByCount> =
  jest.fn();
const mockCancelMarketTokenKlineByCount = jest.fn(
  (_params: { requestId: string }) => Promise.resolve(),
);

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketTokenKline: (params: Parameters<IFetchMarketTokenKline>[0]) =>
        mockFetchMarketTokenKline(params),
      fetchMarketTokenKlineByCount: (
        params: Parameters<IFetchMarketTokenKlineByCount>[0],
      ) => mockFetchMarketTokenKlineByCount(params),
      cancelMarketTokenKlineByCount: (params: { requestId: string }) =>
        mockCancelMarketTokenKlineByCount(params),
    },
  },
}));

jest.mock('../sliceRequest', () => ({
  sliceRequest: jest.fn(),
}));

const mockSliceRequest = sliceRequest as jest.MockedFunction<
  typeof sliceRequest
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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
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
        points: [buildPoint(1200), buildPoint(1080), buildPoint(1060, 2)],
        total: 3,
      });

    const result = await fetchTradingViewV2DataWithSlicing({
      tokenAddress: '0x123',
      networkId: 'evm--1',
      kLineProvider: 'onekey',
      kLineProviderSymbol: undefined,
      interval: '1m',
      timeFrom: 1000,
      timeTo: 1120,
    });

    expect(mockSliceRequest).toHaveBeenCalledWith('1m', 1000, 1120, {
      isNativeToken: false,
      minTimeSpanSeconds: 172_800,
    });
    expect(mockFetchMarketTokenKline).toHaveBeenNthCalledWith(1, {
      tokenAddress: '0x123',
      networkId: 'evm--1',
      interval: '1m',
      timeFrom: 900,
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

  it('marks primary data unavailable when primary response is not valid and fallback has points', async () => {
    const onPrimaryKLineDataUnavailable = jest.fn();
    const fallback = jest.fn().mockResolvedValue({
      points: [buildPoint(2040, 4)],
      total: 1,
    });
    mockSliceRequest.mockReturnValue([
      { from: 2000, to: 2120, interval: '1m' },
    ]);
    mockFetchMarketTokenKline.mockResolvedValueOnce(null);

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

describe('first-screen K-line prefetch subscription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the expanded first-screen buffer for the prefetch target count', async () => {
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { innerWidth: 1688 },
    });
    const tokenAddress = '0x0000000000000000000000000000000000000789';
    mockFetchMarketTokenKlineByCount.mockResolvedValueOnce({
      points: [buildPoint(1020, 3)],
      total: 1,
      historyMeta: {
        noData: true,
        requestedCount: 466,
        returnedCount: 1,
        coveredFrom: 1000,
        coveredTo: 1120,
      },
    });

    try {
      await prefetchTradingViewV2FirstScreenData({
        tokenAddress,
        networkId: 'evm--1',
        interval: '1m',
      });

      expect(mockFetchMarketTokenKlineByCount).toHaveBeenCalledWith(
        expect.objectContaining({
          // Wide screens are capped to the backend single-page limit.
          targetCount: 299,
          stopAfterCount: 299,
        }),
      );
    } finally {
      if (originalWindow === undefined) {
        Reflect.deleteProperty(globalThis, 'window');
      } else {
        Object.defineProperty(globalThis, 'window', {
          configurable: true,
          value: originalWindow,
        });
      }
    }
  });

  it('delivers a prefetch result when registration happens after the chart subscribes', async () => {
    const onResult = jest.fn();
    const tokenAddress = '0x0000000000000000000000000000000000000123';
    const unsubscribe = subscribeTradingViewV2FirstScreenPrefetch({
      tokenAddress,
      networkId: 'evm--1',
      interval: '1m',
      kLineProvider: 'onekey',
      onResult,
    });
    const response: IMarketTokenKLineResponse = {
      points: [buildPoint(1020, 3)],
      total: 1,
      historyMeta: {
        noData: true,
        requestedCount: 200,
        returnedCount: 1,
        coveredFrom: 1000,
        coveredTo: 1120,
      },
    };
    mockFetchMarketTokenKlineByCount.mockResolvedValueOnce(response);

    await prefetchTradingViewV2FirstScreenData({
      tokenAddress,
      networkId: 'evm--1',
      interval: '1m',
    });

    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({
        interval: '1m',
        points: response.points,
        historyExhausted: true,
      }),
    );
    unsubscribe();
  });

  it('publishes a request-budget terminal package without retrying', async () => {
    const onResult = jest.fn();
    const tokenAddress = '0x0000000000000000000000000000000000000345';
    const completedResponse: IMarketTokenKLineResponse = {
      points: [buildPoint(1020, 2), buildPoint(1080, 3)],
      total: 2,
      historyMeta: {
        noData: true,
        isPartial: false,
        stopReason: 'page_budget_exhausted',
        requestedCount: 200,
        returnedCount: 2,
        coveredFrom: 940,
        coveredTo: 1120,
      },
    };
    mockFetchMarketTokenKlineByCount.mockResolvedValueOnce(completedResponse);
    const unsubscribe = subscribeTradingViewV2FirstScreenPrefetch({
      tokenAddress,
      networkId: 'evm--1',
      interval: '1m',
      kLineProvider: 'onekey',
      onResult,
    });

    await prefetchTradingViewV2FirstScreenData({
      tokenAddress,
      networkId: 'evm--1',
      interval: '1m',
    });
    for (
      let attempt = 0;
      attempt < 10 && onResult.mock.calls.length < 1;
      attempt += 1
    ) {
      await Promise.resolve();
    }

    expect(mockFetchMarketTokenKlineByCount).toHaveBeenCalledTimes(1);
    expect(mockFetchMarketTokenKlineByCount).toHaveBeenCalledWith(
      expect.objectContaining({
        stopAfterCount: expect.any(Number),
      }),
    );
    const firstCall = mockFetchMarketTokenKlineByCount.mock.calls[0][0];
    expect(firstCall.stopAfterCount).toBe(firstCall.targetCount);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({
        points: completedResponse.points,
        historyExhausted: true,
      }),
    );
    unsubscribe();
  });

  it('waits for the native-token target before publishing its first package', async () => {
    const onResult = jest.fn();
    const nativePoints = Array.from({ length: 195 }, (_, index) =>
      buildPoint(1000 + index * 60, index + 1),
    );
    const response: IMarketTokenKLineResponse = {
      points: nativePoints,
      total: nativePoints.length,
      historyMeta: {
        noData: false,
        isPartial: true,
        requestedCount: 200,
        returnedCount: nativePoints.length,
        coveredFrom: 1000,
        coveredTo: 13_000,
      },
    };
    mockFetchMarketTokenKlineByCount.mockResolvedValueOnce(response);
    const unsubscribe = subscribeTradingViewV2FirstScreenPrefetch({
      tokenAddress: '',
      networkId: 'btc--0',
      interval: '1m',
      kLineProvider: 'onekey',
      onResult,
    });

    await prefetchTradingViewV2FirstScreenData({
      tokenAddress: '',
      networkId: 'btc--0',
      interval: '1m',
      kLineProvider: 'onekey',
    });

    expect(mockFetchMarketTokenKlineByCount).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenAddress: '',
        networkId: 'btc--0',
        targetCount: 200,
        stopAfterCount: 200,
      }),
    );
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({
        points: nativePoints,
        historyExhausted: false,
      }),
    );
    unsubscribe();
  });

  it('prefetches BTC native-token bars through the HyperLiquid identity', async () => {
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { innerWidth: 1688 },
    });
    const onResult = jest.fn();
    const btcPoints = Array.from({ length: 299 }, (_, index) =>
      buildPoint(1000 + index * 60, index + 1),
    );
    const response: IMarketTokenKLineResponse = {
      points: btcPoints,
      total: btcPoints.length,
      historyMeta: {
        noData: false,
        isPartial: false,
        requestedCount: 299,
        returnedCount: btcPoints.length,
        coveredFrom: 1000,
        coveredTo: 19_000,
      },
    };
    mockFetchMarketTokenKlineByCount.mockResolvedValueOnce(response);
    const identity = {
      tokenAddress: '',
      networkId: 'btc--0',
      interval: '1m',
      kLineProvider: 'hyperliquid' as const,
      kLineProviderSymbol: 'BTC',
    };
    const unsubscribe = subscribeTradingViewV2FirstScreenPrefetch({
      ...identity,
      onResult,
    });

    try {
      await prefetchTradingViewV2FirstScreenData(identity);

      expect(mockFetchMarketTokenKlineByCount).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenAddress: '',
          networkId: 'btc--0',
          provider: 'hyperliquid',
          providerSymbol: 'BTC',
          targetCount: 299,
          stopAfterCount: 299,
        }),
      );
      expect(onResult).toHaveBeenCalledTimes(1);
      expect(onResult).toHaveBeenCalledWith(
        expect.objectContaining({
          points: btcPoints,
          historyExhausted: false,
        }),
      );
    } finally {
      unsubscribe();
      if (originalWindow === undefined) {
        Reflect.deleteProperty(globalThis, 'window');
      } else {
        Object.defineProperty(globalThis, 'window', {
          configurable: true,
          value: originalWindow,
        });
      }
    }
  });

  it('does not deliver a late registration after the chart unsubscribes', async () => {
    const onResult = jest.fn();
    const tokenAddress = '0x0000000000000000000000000000000000000456';
    const unsubscribe = subscribeTradingViewV2FirstScreenPrefetch({
      tokenAddress,
      networkId: 'evm--1',
      interval: '1m',
      kLineProvider: 'onekey',
      onResult,
    });
    unsubscribe();
    mockFetchMarketTokenKlineByCount.mockResolvedValueOnce({
      points: [buildPoint(1020, 3)],
      total: 1,
      historyMeta: {
        noData: true,
        requestedCount: 200,
        returnedCount: 1,
        coveredFrom: 1000,
        coveredTo: 1120,
      },
    });

    await prefetchTradingViewV2FirstScreenData({
      tokenAddress,
      networkId: 'evm--1',
      interval: '1m',
    });

    expect(onResult).not.toHaveBeenCalled();
  });

  it('retries immediately after a first-screen prefetch rejects', async () => {
    const identity = {
      tokenAddress: '0x0000000000000000000000000000000000000567',
      networkId: 'evm--1',
      interval: '1m',
    };
    let dateNowCallCount = 0;
    const dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      dateNowCallCount += 1;
      if (dateNowCallCount === 4) {
        throw new OneKeyLocalError('prefetch failed');
      }
      return 1000;
    });

    await expect(
      prefetchTradingViewV2FirstScreenData(identity),
    ).rejects.toThrow('prefetch failed');
    dateNowSpy.mockRestore();
    await Promise.resolve();
    mockFetchMarketTokenKlineByCount.mockResolvedValueOnce({
      points: [buildPoint(1020, 3)],
      total: 1,
    });
    await expect(
      prefetchTradingViewV2FirstScreenData(identity),
    ).resolves.toEqual(
      expect.objectContaining({ points: [buildPoint(1020, 3)] }),
    );

    expect(mockFetchMarketTokenKlineByCount).toHaveBeenCalledTimes(1);
  });

  it('does not cancel a pending prefetch that has an active chart subscriber', async () => {
    const activeIdentity = {
      tokenAddress: '0x0000000000000000000000000000000000000578',
      networkId: 'evm--1',
      interval: '1m',
    };
    const hoverIdentity = {
      tokenAddress: '0x0000000000000000000000000000000000000589',
      networkId: 'evm--1',
      interval: '1m',
    };
    const activeResponse = createDeferred<IMarketTokenKLineResponse | null>();
    mockFetchMarketTokenKlineByCount
      .mockReturnValueOnce(activeResponse.promise)
      .mockResolvedValueOnce({
        points: [buildPoint(1080, 4)],
        total: 1,
      });
    const unsubscribe = subscribeTradingViewV2FirstScreenPrefetch({
      ...activeIdentity,
      kLineProvider: 'onekey',
      onResult: jest.fn(),
    });
    const activePromise = prefetchTradingViewV2FirstScreenData(activeIdentity);

    await prefetchTradingViewV2FirstScreenData(hoverIdentity);

    expect(mockCancelMarketTokenKlineByCount).not.toHaveBeenCalled();
    activeResponse.resolve({
      points: [buildPoint(1020, 3)],
      total: 1,
    });
    await activePromise;
    unsubscribe();
  });

  it('reuses a completed first-screen prefetch for later chart history requests', async () => {
    const nowSeconds = 1_000_000;
    const targetCount = 269;
    const tokenAddress = '0x0000000000000000000000000000000000000678';
    const dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(nowSeconds * 1000);
    const completedPoints = Array.from({ length: targetCount }, (_, index) =>
      buildPoint(nowSeconds - (targetCount - index) * 60, index + 1),
    );
    const completedResponse: IMarketTokenKLineResponse = {
      points: completedPoints,
      total: completedPoints.length,
      historyMeta: {
        noData: false,
        isPartial: false,
        requestedCount: targetCount,
        returnedCount: completedPoints.length,
        coveredFrom: nowSeconds - targetCount * 60,
        coveredTo: nowSeconds + 5 * 60,
      },
    };
    mockFetchMarketTokenKlineByCount.mockResolvedValueOnce(completedResponse);

    try {
      const initialResult = await prefetchTradingViewV2FirstScreenData({
        tokenAddress,
        networkId: 'evm--1',
        interval: '1m',
      });

      expect(initialResult?.points).toHaveLength(targetCount);
      expect(mockFetchMarketTokenKlineByCount).toHaveBeenCalledTimes(1);
      const completedRequest =
        mockFetchMarketTokenKlineByCount.mock.calls[0][0];
      expect(completedRequest.stopAfterCount).toBe(
        completedRequest.targetCount,
      );

      const historyResult = await fetchTradingViewV2DataWithSlicing({
        tokenAddress,
        networkId: 'evm--1',
        interval: '1m',
        timeFrom: completedRequest.timeFrom,
        timeTo: completedRequest.timeTo,
        targetCount: 200,
        requestExactRange: true,
        reuseLatestPage: true,
      });
      expect(mockFetchMarketTokenKlineByCount).toHaveBeenCalledTimes(1);
      expect(historyResult?.points).toHaveLength(200);
      expect(historyResult?.historyMeta).toMatchObject({
        noData: false,
        isPartial: false,
        requestedCount: 200,
        returnedCount: 200,
      });
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('does not coalesce pending requests with different history start times', async () => {
    const tokenAddress = '0x0000000000000000000000000000000000000689';
    const firstRequest = createDeferred<IMarketTokenKLineResponse | null>();
    const secondRequest = createDeferred<IMarketTokenKLineResponse | null>();
    mockFetchMarketTokenKlineByCount
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);
    const requestParams = {
      tokenAddress,
      networkId: 'evm--1',
      interval: '1m',
      timeFrom: 1000,
      timeTo: 1120,
      targetCount: 1,
      requestExactRange: true,
    };

    const firstPromise = fetchTradingViewV2DataWithSlicing({
      ...requestParams,
      historyStartTime: 100,
    });
    const secondPromise = fetchTradingViewV2DataWithSlicing({
      ...requestParams,
      historyStartTime: 200,
    });

    expect(mockFetchMarketTokenKlineByCount).toHaveBeenCalledTimes(2);
    expect(mockFetchMarketTokenKlineByCount).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ historyStartTime: 100 }),
    );
    expect(mockFetchMarketTokenKlineByCount).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ historyStartTime: 200 }),
    );

    firstRequest.resolve({ points: [buildPoint(1020, 1)], total: 1 });
    secondRequest.resolve({ points: [buildPoint(1080, 2)], total: 1 });
    await expect(firstPromise).resolves.toMatchObject({
      points: [buildPoint(1020, 1)],
    });
    await expect(secondPromise).resolves.toMatchObject({
      points: [buildPoint(1080, 2)],
    });
  });

  it('does not reuse a retained prefetch with a different history start time', async () => {
    const tokenAddress = '0x0000000000000000000000000000000000000690';
    mockFetchMarketTokenKlineByCount
      .mockResolvedValueOnce({
        points: [buildPoint(1020, 1)],
        total: 1,
        historyMeta: { noData: true },
      })
      .mockResolvedValueOnce({
        points: [buildPoint(1080, 2)],
        total: 1,
        historyMeta: { noData: true },
      });

    const firstResult = await prefetchTradingViewV2FirstScreenData({
      tokenAddress,
      networkId: 'evm--1',
      interval: '1m',
      historyStartTime: 100,
    });
    const secondResult = await prefetchTradingViewV2FirstScreenData({
      tokenAddress,
      networkId: 'evm--1',
      interval: '1m',
      historyStartTime: 200,
    });

    expect(mockFetchMarketTokenKlineByCount).toHaveBeenCalledTimes(2);
    expect(mockFetchMarketTokenKlineByCount).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ historyStartTime: 100 }),
    );
    expect(mockFetchMarketTokenKlineByCount).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ historyStartTime: 200 }),
    );
    expect(firstResult?.points).toEqual([buildPoint(1020, 1)]);
    expect(secondResult?.points).toEqual([buildPoint(1080, 2)]);
  });
});
