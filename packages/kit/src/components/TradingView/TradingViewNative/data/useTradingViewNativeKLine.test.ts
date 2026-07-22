/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import type {
  IMarketTokenKLineDataPoint,
  IMarketTokenKLineResponse,
} from '@onekeyhq/shared/types/marketV2';

import { createTradingViewNativeDataProvider } from './createTradingViewNativeDataProvider';
import { getTradingViewNativeSourceKey } from './getTradingViewNativeSource';
import { useTradingViewNativeKLine } from './useTradingViewNativeKLine';

import type {
  ITradingViewNativeDataProvider,
  ITradingViewNativeHistoryRequest,
  ITradingViewNativeRealtimeSubscriptionRequest,
} from './tradingViewNativeDataProviderTypes';
import type { ITradingViewNativeSource } from '../types';

const mockFetchHistory = jest.fn<
  Promise<IMarketTokenKLineResponse | null>,
  [ITradingViewNativeHistoryRequest]
>();
const mockEnsure = jest.fn<Promise<void>, []>();
const mockUnsubscribe = jest.fn<Promise<void>, []>();
const mockSubscribeRealtime = jest.fn<
  ReturnType<ITradingViewNativeDataProvider['subscribeRealtime']>,
  [ITradingViewNativeRealtimeSubscriptionRequest]
>();
let realtimePointListener:
  | ((point: IMarketTokenKLineDataPoint) => void)
  | undefined;
let mockCurrentVisibility = true;
let mockVisibilityListener: ((isVisible: boolean) => void) | undefined;
let mockHistoryBatchSize = 1;
let mockHistoryRequestCandleCount = 1;

jest.mock('@onekeyhq/components/src/hooks/useVisibilityChange', () => ({
  getCurrentVisibilityState: () => mockCurrentVisibility,
  onVisibilityStateChange: (listener: (isVisible: boolean) => void) => {
    mockVisibilityListener = listener;
    return () => {
      if (mockVisibilityListener === listener) {
        mockVisibilityListener = undefined;
      }
    };
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    networkDoctor: { log: { error: jest.fn() } },
  },
}));

jest.mock('./createTradingViewNativeDataProvider', () => ({
  createTradingViewNativeDataProvider: jest.fn(),
}));

const mockCreateTradingViewNativeDataProvider =
  createTradingViewNativeDataProvider as jest.MockedFunction<
    typeof createTradingViewNativeDataProvider
  >;

function buildResponse(
  close: number,
  timestamp = close,
): IMarketTokenKLineResponse {
  return {
    points: [
      {
        o: close,
        h: close + 1,
        l: close - 1,
        c: close,
        v: 10,
        t: timestamp,
      },
    ],
    total: 1,
  };
}

function buildMultiPointResponse(
  candles: { close: number; timestamp: number }[],
): IMarketTokenKLineResponse {
  return {
    points: candles.map(({ close, timestamp }) => ({
      o: close,
      h: close + 1,
      l: close - 1,
      c: close,
      v: 10,
      t: timestamp,
    })),
    total: candles.length,
  };
}

function buildSequentialResponse({
  count,
  firstTimestamp,
  startingClose = 1,
}: {
  count: number;
  firstTimestamp: number;
  startingClose?: number;
}) {
  return buildMultiPointResponse(
    Array.from({ length: count }, (_, index) => ({
      close: startingClose + index,
      timestamp: firstTimestamp + index * 3600,
    })),
  );
}

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

function buildProviderKey(source: ITradingViewNativeSource) {
  return getTradingViewNativeSourceKey(source);
}

function buildMarketSource({
  fallbackCoinGeckoId,
  realtime = 'disabled',
  tokenAddress = '0x123',
}: {
  fallbackCoinGeckoId?: string;
  realtime?: 'disabled' | 'websocket';
  tokenAddress?: string;
} = {}): ITradingViewNativeSource {
  return {
    kind: 'market',
    ...(fallbackCoinGeckoId ? { fallbackCoinGeckoId } : {}),
    networkId: 'evm--1',
    tokenAddress,
    symbol: 'TOKEN',
    realtime,
  };
}

function pushRealtimePoint(point: IMarketTokenKLineDataPoint) {
  act(() => realtimePointListener?.(point));
}

function updateVisibility(isVisible: boolean) {
  mockCurrentVisibility = isVisible;
  act(() => mockVisibilityListener?.(isVisible));
}

describe('TradingViewNative K-line data state machine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchHistory.mockReset();
    mockHistoryBatchSize = 1;
    mockHistoryRequestCandleCount = 1;
    mockCurrentVisibility = true;
    mockVisibilityListener = undefined;
    realtimePointListener = undefined;
    mockEnsure.mockResolvedValue(undefined);
    mockUnsubscribe.mockResolvedValue(undefined);
    mockSubscribeRealtime.mockImplementation(async (request) => {
      realtimePointListener = request.onPoint;
      return {
        ensure: mockEnsure,
        unsubscribe: mockUnsubscribe,
      };
    });
    mockCreateTradingViewNativeDataProvider.mockImplementation((source) => ({
      getHistoryRequestCandleCount: () => mockHistoryRequestCandleCount,
      hasMoreHistory: ({ receivedPointCount }) =>
        receivedPointCount >= mockHistoryBatchSize,
      isReady: true,
      key: buildProviderKey(source),
      supportsRealtime:
        source.kind === 'hyperliquid' ||
        (source.kind === 'market' && source.realtime === 'websocket'),
      fetchHistory: mockFetchHistory,
      subscribeRealtime: mockSubscribeRealtime,
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('requests the full provider batch on the initial history load', async () => {
    mockHistoryBatchSize = 3;
    mockHistoryRequestCandleCount = 3;
    jest.spyOn(Date, 'now').mockReturnValue(100_000_000);
    mockFetchHistory.mockResolvedValue(
      buildMultiPointResponse([
        { close: 90, timestamp: 92_800 },
        { close: 100, timestamp: 96_400 },
        { close: 110, timestamp: 100_000 },
      ]),
    );

    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(3));
    expect(mockFetchHistory.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        timeFrom: 89_200,
        timeTo: 100_000,
      }),
    );
  });

  it('does not paginate when the initial batch is shorter than requested', async () => {
    mockHistoryBatchSize = 299;
    mockHistoryRequestCandleCount = 2000;
    mockFetchHistory.mockResolvedValue(
      buildSequentialResponse({ count: 298, firstTimestamp: 1_000_000 }),
    );
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(298));
    act(() => result.current.handleVisiblePointRangeChange({ startIndex: 0 }));

    expect(mockFetchHistory).toHaveBeenCalledTimes(1);
  });

  it('keeps previous candles until a non-empty interval response arrives', async () => {
    const initialRequest = createDeferred<IMarketTokenKLineResponse | null>();
    const intervalRequest = createDeferred<IMarketTokenKLineResponse | null>();
    mockFetchHistory
      .mockReturnValueOnce(initialRequest.promise)
      .mockReturnValueOnce(intervalRequest.promise)
      .mockResolvedValue({ points: [], total: 0 });

    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await act(async () => {
      initialRequest.resolve(buildResponse(100));
      await initialRequest.promise;
    });
    await waitFor(() => expect(result.current.points[0]?.c).toBe(100));

    act(() => result.current.handleIntervalChange('1'));
    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(2));
    expect(result.current.points[0]?.c).toBe(100);
    expect(result.current.candleIntervalSeconds).toBe(60 * 60);
    expect(result.current.isSwitchingInterval).toBe(true);

    jest.useFakeTimers();
    await act(async () => {
      intervalRequest.resolve({ points: [], total: 0 });
      await intervalRequest.promise;
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(4001);
    });
    jest.useRealTimers();
    await waitFor(() =>
      expect(result.current.intervalConfig.activeInterval).toBe('60'),
    );
    expect(result.current.points[0]?.c).toBe(100);
    expect(result.current.dataState.status).toBe('stale');
  });

  it('hides another series immediately and ignores its obsolete response', async () => {
    const firstRequest = createDeferred<IMarketTokenKLineResponse | null>();
    const secondRequest = createDeferred<IMarketTokenKLineResponse | null>();
    mockFetchHistory
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    const { result, rerender } = renderHook(
      ({ tokenAddress }: { tokenAddress: string }) =>
        useTradingViewNativeKLine({
          source: buildMarketSource({ tokenAddress }),
        }),
      { initialProps: { tokenAddress: '0x123' } },
    );

    rerender({ tokenAddress: '0x456' });
    expect(result.current.points).toEqual([]);

    await act(async () => {
      secondRequest.resolve(buildResponse(200));
      await secondRequest.promise;
    });
    await waitFor(() => expect(result.current.points[0]?.c).toBe(200));

    await act(async () => {
      firstRequest.resolve(buildResponse(100));
      await firstRequest.promise;
    });
    expect(result.current.points[0]?.c).toBe(200);
  });

  it('enables Market realtime without restarting in-flight history', async () => {
    const historyRequest = createDeferred<IMarketTokenKLineResponse | null>();
    mockFetchHistory.mockReturnValue(historyRequest.promise);
    const { result, rerender } = renderHook(
      ({ realtime }: { realtime: 'disabled' | 'websocket' }) =>
        useTradingViewNativeKLine({
          source: buildMarketSource({ realtime }),
        }),
      {
        initialProps: {
          realtime: 'disabled' as 'disabled' | 'websocket',
        },
      },
    );

    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(1));
    const initialHistorySignal = mockFetchHistory.mock.calls[0]?.[0].signal;
    expect(mockSubscribeRealtime).not.toHaveBeenCalled();

    rerender({ realtime: 'websocket' });
    await waitFor(() => expect(mockSubscribeRealtime).toHaveBeenCalledTimes(1));
    expect(mockFetchHistory).toHaveBeenCalledTimes(1);
    expect(initialHistorySignal?.aborted).toBe(false);

    await act(async () => {
      historyRequest.resolve(buildResponse(100));
      await historyRequest.promise;
    });
    await waitFor(() => expect(result.current.points[0]?.c).toBe(100));
    expect(mockFetchHistory).toHaveBeenCalledTimes(1);
  });

  it('merges replacement and appended realtime candles', async () => {
    const handleRealtimePoint = jest.fn();
    mockFetchHistory.mockResolvedValue(buildResponse(100));
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({
        onRealtimePoint: handleRealtimePoint,
        source: buildMarketSource({ realtime: 'websocket' }),
      }),
    );

    await waitFor(() => expect(result.current.points[0]?.c).toBe(100));
    await waitFor(() => expect(mockSubscribeRealtime).toHaveBeenCalled());
    expect(result.current.dataState.status).toBe('live');
    pushRealtimePoint({ o: 100, h: 106, l: 99, c: 105, v: 12, t: 100 });
    expect(result.current.chartPictureVersion).toBe(0);
    pushRealtimePoint({ o: 105, h: 111, l: 104, c: 110, v: 8, t: 200 });

    expect(result.current.points.map((point) => point.c)).toEqual([105, 110]);
    expect(result.current.chartPictureVersion).toBe(1);
    expect(result.current.dataState.status).toBe('live');
    expect(handleRealtimePoint).toHaveBeenNthCalledWith(1, {
      o: 100,
      h: 106,
      l: 99,
      c: 105,
      v: 12,
      t: 100,
    });
    expect(handleRealtimePoint).toHaveBeenNthCalledWith(2, {
      o: 105,
      h: 111,
      l: 104,
      c: 110,
      v: 8,
      t: 200,
    });
  });

  it('buffers realtime candles while history is loading', async () => {
    const historyRequest = createDeferred<IMarketTokenKLineResponse | null>();
    mockFetchHistory.mockReturnValue(historyRequest.promise);
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({
        source: buildMarketSource({ realtime: 'websocket' }),
      }),
    );

    await waitFor(() => expect(mockSubscribeRealtime).toHaveBeenCalled());
    pushRealtimePoint({ o: 100, h: 106, l: 99, c: 105, v: 12, t: 100 });
    expect(result.current.points.map((point) => point.c)).toEqual([105]);
    await act(async () => {
      historyRequest.resolve(buildResponse(100));
      await historyRequest.promise;
    });

    await waitFor(() => expect(result.current.points[0]?.c).toBe(105));
  });

  it('loads and prepends one older page near the left boundary', async () => {
    mockHistoryBatchSize = 2;
    mockHistoryRequestCandleCount = 2;
    const olderHistoryRequest =
      createDeferred<IMarketTokenKLineResponse | null>();
    mockFetchHistory
      .mockResolvedValueOnce(
        buildMultiPointResponse([
          { close: 100, timestamp: 1_000_000 },
          { close: 110, timestamp: 1_003_600 },
        ]),
      )
      .mockReturnValueOnce(olderHistoryRequest.promise)
      .mockResolvedValueOnce(
        buildMultiPointResponse([
          { close: 110, timestamp: 1_003_600 },
          { close: 120, timestamp: 1_007_200 },
        ]),
      );
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(2));
    act(() => result.current.handleVisiblePointRangeChange({ startIndex: 21 }));
    expect(mockFetchHistory).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.handleVisiblePointRangeChange({ startIndex: 20 });
      result.current.handleVisiblePointRangeChange({ startIndex: 0 });
    });
    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(2));
    expect(mockFetchHistory.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        interval: expect.objectContaining({ value: '60' }),
        timeFrom: 992_799,
        timeTo: 999_999,
      }),
    );

    await act(async () => {
      olderHistoryRequest.resolve(
        buildMultiPointResponse([
          { close: 80, timestamp: 992_800 },
          { close: 90, timestamp: 996_400 },
        ]),
      );
      await olderHistoryRequest.promise;
    });
    await waitFor(() =>
      expect(result.current.points.map((point) => point.c)).toEqual([
        80, 90, 100, 110,
      ]),
    );

    updateVisibility(false);
    updateVisibility(true);
    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(3));
    await waitFor(() =>
      expect(result.current.points.map((point) => point.c)).toEqual([
        80, 90, 100, 110, 120,
      ]),
    );
  });

  it('treats an empty older page as history EOF without retrying', async () => {
    mockHistoryBatchSize = 1;
    mockHistoryRequestCandleCount = 1;
    mockFetchHistory
      .mockResolvedValueOnce(buildResponse(100, 1_000_000))
      .mockResolvedValueOnce({ points: [], total: 0 });
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(1));
    act(() => result.current.handleVisiblePointRangeChange({ startIndex: 0 }));
    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(2));

    act(() => result.current.handleVisiblePointRangeChange({ startIndex: 0 }));
    expect(mockFetchHistory).toHaveBeenCalledTimes(2);
  });

  it('follows the Market API 2000-slot window and 299-point page contract', async () => {
    mockHistoryBatchSize = 299;
    mockHistoryRequestCandleCount = 2000;
    mockFetchHistory
      .mockResolvedValueOnce(
        buildSequentialResponse({
          count: 299,
          firstTimestamp: 10_000_000,
          startingClose: 1000,
        }),
      )
      .mockResolvedValueOnce(
        buildSequentialResponse({
          count: 299,
          firstTimestamp: 8_923_600,
          startingClose: 700,
        }),
      )
      .mockResolvedValueOnce(
        buildSequentialResponse({
          count: 298,
          firstTimestamp: 7_850_800,
          startingClose: 400,
        }),
      );
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(299));
    act(() => result.current.handleVisiblePointRangeChange({ startIndex: 0 }));
    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(2));
    expect(mockFetchHistory.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        timeFrom: 2_799_999,
        timeTo: 9_999_999,
      }),
    );
    await waitFor(() => expect(result.current.points).toHaveLength(598));
    act(() => result.current.handleVisiblePointRangeChange({ startIndex: 0 }));
    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(3));
    expect(mockFetchHistory.mock.calls[2]?.[0]).toEqual(
      expect.objectContaining({
        timeFrom: 1_723_599,
        timeTo: 8_923_599,
      }),
    );
    await waitFor(() => expect(result.current.points).toHaveLength(896));
    act(() => result.current.handleVisiblePointRangeChange({ startIndex: 0 }));
    expect(mockFetchHistory).toHaveBeenCalledTimes(3);
  });

  it('continues native Market pagination after a full 200-point page', async () => {
    mockHistoryBatchSize = 200;
    mockHistoryRequestCandleCount = 2000;
    mockFetchHistory
      .mockResolvedValueOnce(
        buildSequentialResponse({
          count: 200,
          firstTimestamp: 10_000_000,
          startingClose: 1000,
        }),
      )
      .mockResolvedValueOnce(
        buildSequentialResponse({
          count: 199,
          firstTimestamp: 9_283_600,
          startingClose: 800,
        }),
      );
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({
        source: buildMarketSource({ tokenAddress: '' }),
      }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(200));
    act(() => result.current.handleVisiblePointRangeChange({ startIndex: 0 }));
    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.points).toHaveLength(399));

    act(() => result.current.handleVisiblePointRangeChange({ startIndex: 0 }));
    expect(mockFetchHistory).toHaveBeenCalledTimes(2);
  });

  it('loads older history through the Hyperliquid provider path', async () => {
    mockHistoryBatchSize = 2;
    mockHistoryRequestCandleCount = 2;
    mockFetchHistory
      .mockResolvedValueOnce(
        buildMultiPointResponse([
          { close: 63_000, timestamp: 1_000_000 },
          { close: 64_000, timestamp: 1_003_600 },
        ]),
      )
      .mockResolvedValueOnce(buildResponse(62_000, 996_400));
    const source: ITradingViewNativeSource = {
      kind: 'hyperliquid',
      coin: 'BTC',
      environment: 'mainnet',
    };
    const { result } = renderHook(() => useTradingViewNativeKLine({ source }));

    await waitFor(() => expect(result.current.points).toHaveLength(2));
    act(() => result.current.handleVisiblePointRangeChange({ startIndex: 0 }));

    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(2));
    expect(mockFetchHistory.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        interval: expect.objectContaining({
          hyperliquidValue: '1h',
          value: '60',
        }),
        timeFrom: 992_799,
        timeTo: 999_999,
      }),
    );
    await waitFor(() =>
      expect(result.current.points.map((point) => point.c)).toEqual([
        62_000, 63_000, 64_000,
      ]),
    );
    act(() => result.current.handleVisiblePointRangeChange({ startIndex: 0 }));
    expect(mockFetchHistory).toHaveBeenCalledTimes(2);
  });

  it('aborts an obsolete older page when the series changes', async () => {
    const olderHistoryRequest =
      createDeferred<IMarketTokenKLineResponse | null>();
    mockFetchHistory
      .mockResolvedValueOnce(buildResponse(100, 1_000_000))
      .mockReturnValueOnce(olderHistoryRequest.promise)
      .mockResolvedValueOnce(buildResponse(200, 2_000_000));
    const { result, rerender } = renderHook(
      ({ tokenAddress }: { tokenAddress: string }) =>
        useTradingViewNativeKLine({
          source: buildMarketSource({ tokenAddress }),
        }),
      { initialProps: { tokenAddress: '0x123' } },
    );

    await waitFor(() => expect(result.current.points[0]?.c).toBe(100));
    act(() => result.current.handleVisiblePointRangeChange({ startIndex: 0 }));
    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(2));
    const obsoleteRequest = mockFetchHistory.mock.calls[1]?.[0];

    rerender({ tokenAddress: '0x456' });
    await waitFor(() => expect(result.current.points[0]?.c).toBe(200));
    expect(obsoleteRequest?.signal.aborted).toBe(true);

    await act(async () => {
      olderHistoryRequest.resolve(buildResponse(90, 996_400));
      await olderHistoryRequest.promise;
    });
    expect(result.current.points.map((point) => point.c)).toEqual([200]);
  });

  it('resets the series when the CoinGecko fallback identity changes', async () => {
    const olderHistoryRequest =
      createDeferred<IMarketTokenKLineResponse | null>();
    mockFetchHistory
      .mockResolvedValueOnce(buildResponse(100, 1_000_000))
      .mockReturnValueOnce(olderHistoryRequest.promise)
      .mockResolvedValueOnce(buildResponse(200, 2_000_000));
    const { result, rerender } = renderHook(
      ({ fallbackCoinGeckoId }: { fallbackCoinGeckoId: string }) =>
        useTradingViewNativeKLine({
          source: buildMarketSource({ fallbackCoinGeckoId }),
        }),
      { initialProps: { fallbackCoinGeckoId: 'coin-a' } },
    );

    await waitFor(() => expect(result.current.points[0]?.c).toBe(100));
    act(() => result.current.handleVisiblePointRangeChange({ startIndex: 0 }));
    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(2));
    const obsoleteRequest = mockFetchHistory.mock.calls[1]?.[0];

    rerender({ fallbackCoinGeckoId: 'coin-b' });
    expect(result.current.points).toEqual([]);
    expect(obsoleteRequest?.signal.aborted).toBe(true);
    await waitFor(() => expect(result.current.points[0]?.c).toBe(200));

    await act(async () => {
      olderHistoryRequest.resolve(buildResponse(90, 996_400));
      await olderHistoryRequest.promise;
    });
    expect(result.current.points.map((point) => point.c)).toEqual([200]);
  });

  it('routes Hyperliquid through the provider boundary', async () => {
    mockFetchHistory.mockResolvedValue(buildResponse(63_000));
    const source: ITradingViewNativeSource = {
      kind: 'hyperliquid',
      coin: 'BTC',
      environment: 'mainnet',
    };
    const { result } = renderHook(() => useTradingViewNativeKLine({ source }));

    await waitFor(() => expect(result.current.points[0]?.c).toBe(63_000));
    expect(mockCreateTradingViewNativeDataProvider).toHaveBeenCalledWith(
      source,
    );
    expect(mockSubscribeRealtime).toHaveBeenCalledWith(
      expect.objectContaining({
        interval: expect.objectContaining({ hyperliquidValue: '1h' }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('retries a transient history failure automatically', async () => {
    jest.useFakeTimers();
    mockFetchHistory
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce(buildResponse(100));
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await act(async () => {
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(1001);
    });

    expect(mockFetchHistory).toHaveBeenCalledTimes(2);
    expect(result.current.points[0]?.c).toBe(100);
  });

  it('refreshes history after returning to the foreground', async () => {
    mockFetchHistory
      .mockResolvedValueOnce(buildResponse(100, 100))
      .mockResolvedValueOnce({
        points: [
          ...buildResponse(100, 100).points,
          ...buildResponse(110, 200).points,
        ],
        total: 2,
      });
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(1));
    updateVisibility(false);
    updateVisibility(true);

    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(result.current.points.map((point) => point.c)).toEqual([100, 110]),
    );
  });

  it('keeps a quiet healthy subscription live without advancing price freshness', async () => {
    jest.useFakeTimers();
    mockFetchHistory.mockResolvedValue(buildResponse(100));
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({
        source: buildMarketSource({ realtime: 'websocket' }),
      }),
    );

    await waitFor(() => expect(result.current.points[0]?.c).toBe(100));
    await waitFor(() => expect(result.current.dataState.status).toBe('live'));
    const historyUpdatedAt = result.current.dataState.lastUpdatedAt;

    await act(async () => {
      await jest.advanceTimersByTimeAsync(90_001);
    });

    expect(mockEnsure).toHaveBeenCalledTimes(1);
    expect(result.current.dataState.status).toBe('live');
    expect(result.current.dataState.lastUpdatedAt).toBe(historyUpdatedAt);

    pushRealtimePoint({ o: 100, h: 106, l: 99, c: 105, v: 12, t: 100 });
    expect(result.current.dataState.status).toBe('live');
    expect(result.current.dataState.lastUpdatedAt).toBeGreaterThan(
      historyUpdatedAt ?? 0,
    );
  });

  it('reports a history failure and aborts realtime work on cleanup', async () => {
    jest.useFakeTimers();
    const error = new Error('history unavailable');
    mockFetchHistory.mockRejectedValue(error);
    const { result, unmount } = renderHook(() =>
      useTradingViewNativeKLine({
        source: buildMarketSource({ realtime: 'websocket' }),
      }),
    );

    await act(async () => {
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(4001);
    });
    expect(result.current.dataState.status).toBe('error');
    expect(mockFetchHistory).toHaveBeenCalledTimes(3);
    const realtimeRequest = mockSubscribeRealtime.mock.calls[0]?.[0];
    unmount();

    expect(realtimeRequest?.signal.aborted).toBe(true);
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('retries history on demand after the automatic retries are exhausted', async () => {
    jest.useFakeTimers();
    mockFetchHistory.mockRejectedValue(new Error('history unavailable'));
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await act(async () => {
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(4001);
    });
    expect(result.current.dataState.status).toBe('error');
    expect(mockFetchHistory).toHaveBeenCalledTimes(3);

    mockFetchHistory.mockReset();
    mockFetchHistory.mockResolvedValue(buildResponse(100));
    act(() => result.current.handleRetry());

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.points[0]?.c).toBe(100);
    expect(mockFetchHistory).toHaveBeenCalledTimes(1);
  });
});
