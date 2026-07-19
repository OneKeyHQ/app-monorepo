/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import type {
  IMarketTokenKLineDataPoint,
  IMarketTokenKLineResponse,
} from '@onekeyhq/shared/types/marketV2';

import { createTradingViewNativeDataProvider } from './createTradingViewNativeDataProvider';
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
  return source.kind === 'hyperliquid'
    ? `hyperliquid:${source.environment}:${source.coin}`
    : `market:${source.networkId}:${source.tokenAddress}:${source.symbol}`;
}

function buildMarketSource({
  realtime = 'disabled',
  tokenAddress = '0x123',
}: {
  realtime?: 'disabled' | 'websocket';
  tokenAddress?: string;
} = {}): ITradingViewNativeSource {
  return {
    kind: 'market',
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
      isReady: true,
      key: buildProviderKey(source),
      supportsRealtime:
        source.kind === 'hyperliquid' || source.realtime === 'websocket',
      fetchHistory: mockFetchHistory,
      subscribeRealtime: mockSubscribeRealtime,
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
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

  it('merges replacement and appended realtime candles', async () => {
    mockFetchHistory.mockResolvedValue(buildResponse(100));
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({
        source: buildMarketSource({ realtime: 'websocket' }),
      }),
    );

    await waitFor(() => expect(result.current.points[0]?.c).toBe(100));
    await waitFor(() => expect(mockSubscribeRealtime).toHaveBeenCalled());
    expect(result.current.dataState.status).toBe('reconnecting');
    pushRealtimePoint({ o: 100, h: 106, l: 99, c: 105, v: 12, t: 100 });
    pushRealtimePoint({ o: 105, h: 111, l: 104, c: 110, v: 8, t: 200 });

    expect(result.current.points.map((point) => point.c)).toEqual([105, 110]);
    expect(result.current.dataState.status).toBe('live');
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

  it('does not report live or advance realtime freshness without a candle', async () => {
    jest.useFakeTimers();
    mockFetchHistory.mockResolvedValue(buildResponse(100));
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({
        source: buildMarketSource({ realtime: 'websocket' }),
      }),
    );

    await waitFor(() => expect(result.current.points[0]?.c).toBe(100));
    await waitFor(() =>
      expect(result.current.dataState.status).toBe('reconnecting'),
    );
    const historyUpdatedAt = result.current.dataState.lastUpdatedAt;

    await act(async () => {
      await jest.advanceTimersByTimeAsync(90_001);
    });

    expect(mockEnsure).toHaveBeenCalledTimes(1);
    expect(result.current.dataState.status).toBe('reconnecting');
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
});
