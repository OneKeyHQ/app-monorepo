/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import type {
  IMarketTokenKLineDataPoint,
  IMarketTokenKLineResponse,
} from '@onekeyhq/shared/types/marketV2';

import { getTradingViewNativeSourceKey } from './getTradingViewNativeSource';
import { createTradingViewNativeDataProvider } from './providers/createTradingViewNativeDataProvider';
import { emitTradingViewNativeDebugEvent } from './tradingViewNativeDebugLogger';
import {
  readTradingViewNativeActiveInterval,
  saveTradingViewNativeActiveInterval,
} from './tradingViewNativeIntervalStorage';
import {
  clearTradingViewNativeHistoryBoundaryPrefetchCache,
  useTradingViewNativeKLine,
} from './useTradingViewNativeKLine';

import type {
  ITradingViewNativeDataProvider,
  ITradingViewNativeHistoryPageInfo,
  ITradingViewNativeHistoryRequest,
  ITradingViewNativeHistoryResponse,
  ITradingViewNativeRealtimeSubscriptionRequest,
} from './providers/types';
import type { ITradingViewNativeSource } from '../types';

const mockFetchHistory = jest.fn<
  Promise<ITradingViewNativeHistoryResponse | null>,
  [ITradingViewNativeHistoryRequest]
>();
const mockHasMoreHistory = jest.fn<
  boolean,
  [ITradingViewNativeHistoryPageInfo]
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

jest.mock('./providers/createTradingViewNativeDataProvider', () => ({
  createTradingViewNativeDataProvider: jest.fn(),
}));

jest.mock('./tradingViewNativeDebugLogger', () => ({
  emitTradingViewNativeDebugEvent: jest.fn(),
  getTradingViewNativeDebugErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
}));

jest.mock('./tradingViewNativeIntervalStorage', () => {
  const actual = jest.requireActual<
    typeof import('./tradingViewNativeIntervalStorage')
  >('./tradingViewNativeIntervalStorage');
  return {
    ...actual,
    readTradingViewNativeActiveInterval: jest.fn(),
    saveTradingViewNativeActiveInterval: jest.fn(),
  };
});

const mockCreateTradingViewNativeDataProvider =
  createTradingViewNativeDataProvider as jest.MockedFunction<
    typeof createTradingViewNativeDataProvider
  >;
const mockEmitTradingViewNativeDebugEvent = jest.mocked(
  emitTradingViewNativeDebugEvent,
);
const mockReadTradingViewNativeActiveInterval = jest.mocked(
  readTradingViewNativeActiveInterval,
);
const mockSaveTradingViewNativeActiveInterval = jest.mocked(
  saveTradingViewNativeActiveInterval,
);

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

function buildFallbackMultiPointResponse(
  candles: { close: number; timestamp: number }[],
): ITradingViewNativeHistoryResponse {
  return {
    ...buildMultiPointResponse(candles),
    historySource: 'fallback',
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
  isNative,
  realtime = 'disabled',
  symbol = 'TOKEN',
  tokenAddress = '0x123',
}: {
  fallbackCoinGeckoId?: string;
  isNative?: boolean;
  realtime?: 'disabled' | 'websocket';
  symbol?: string;
  tokenAddress?: string;
} = {}): ITradingViewNativeSource {
  return {
    kind: 'market',
    ...(fallbackCoinGeckoId ? { fallbackCoinGeckoId } : {}),
    ...(isNative ? { isNative: true } : {}),
    networkId: 'evm--1',
    tokenAddress,
    symbol,
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
    clearTradingViewNativeHistoryBoundaryPrefetchCache();
    jest.clearAllMocks();
    mockFetchHistory.mockReset();
    mockReadTradingViewNativeActiveInterval.mockReset();
    mockReadTradingViewNativeActiveInterval.mockReturnValue('60');
    mockSaveTradingViewNativeActiveInterval.mockReset();
    mockHasMoreHistory.mockImplementation(
      ({ historySource, receivedPointCount }) =>
        historySource !== 'fallback' &&
        receivedPointCount >= mockHistoryBatchSize,
    );
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
      hasMoreHistory: mockHasMoreHistory,
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

  it('preserves the self-maintained Asset source for history requests', async () => {
    mockFetchHistory.mockResolvedValue(buildResponse(0.08, 1_000_000));

    const { result } = renderHook(() =>
      useTradingViewNativeKLine({
        source: { kind: 'asset', assetId: 'doge' },
      }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(1));
    expect(mockCreateTradingViewNativeDataProvider).toHaveBeenCalledWith({
      kind: 'asset',
      assetId: 'doge',
    });
    expect(mockSubscribeRealtime).not.toHaveBeenCalled();
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

  it('publishes history and fallback decisions to the development event log', async () => {
    mockFetchHistory.mockResolvedValue({
      ...buildResponse(100, 100_000),
      historySource: 'fallback',
    });

    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(1));
    expect(mockEmitTradingViewNativeDebugEvent).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'history.request' }),
    );
    expect(mockEmitTradingViewNativeDebugEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ historySource: 'fallback' }),
        level: 'warning',
        name: 'history.response',
      }),
    );
    expect(mockEmitTradingViewNativeDebugEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'warning',
        name: 'history.fallback.used',
      }),
    );
  });

  it('logs a fallback response as dropped after primary history is selected', async () => {
    mockFetchHistory
      .mockResolvedValueOnce(buildResponse(100, 100_000))
      .mockResolvedValueOnce({
        ...buildResponse(110, 100_000),
        historySource: 'fallback',
      });

    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );
    await waitFor(() => expect(result.current.points[0]?.c).toBe(100));
    mockEmitTradingViewNativeDebugEvent.mockClear();

    updateVisibility(false);
    updateVisibility(true);
    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(2));

    expect(result.current.points[0]?.c).toBe(100);
    expect(mockEmitTradingViewNativeDebugEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          historySource: 'fallback',
          reason: 'source-mismatch',
          selectedHistorySource: 'primary',
        }),
        level: 'warning',
        name: 'history.response.dropped',
      }),
    );
    expect(
      mockEmitTradingViewNativeDebugEvent.mock.calls.some(
        ([event]) => event.name === 'history.fallback.used',
      ),
    ).toBe(false);
    expect(
      mockEmitTradingViewNativeDebugEvent.mock.calls.some(
        ([event]) =>
          event.name === 'history.response' &&
          event.details?.historySource === 'fallback',
      ),
    ).toBe(false);
  });

  it('keeps the selected history source across every interval', async () => {
    mockFetchHistory.mockImplementation(async ({ interval }) => {
      if (interval.value === '60') {
        return buildResponse(100, 200_000);
      }
      if (interval.value === '1W') {
        return {
          ...buildResponse(80, 100_000),
          historySource: 'fallback',
        };
      }
      return {
        ...buildResponse(90, 110_000),
        historySource: 'fallback',
      };
    });
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(1));
    mockEmitTradingViewNativeDebugEvent.mockClear();
    act(() => result.current.handleHistoryBoundaryPrefetch());
    await waitFor(() =>
      expect(
        mockFetchHistory.mock.calls.some(
          ([request]) => request.interval.value === '1W',
        ),
      ).toBe(true),
    );

    expect(result.current.calendarAvailableTimeRange).toBeUndefined();
    expect(
      mockFetchHistory.mock.calls.some(
        ([request]) => request.interval.value === '1D',
      ),
    ).toBe(false);
    expect(mockEmitTradingViewNativeDebugEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          historySource: 'fallback',
          interval: '1W',
          reason: 'source-mismatch',
          selectedHistorySource: 'primary',
        }),
        level: 'warning',
        name: 'history.response.dropped',
      }),
    );
  });

  it('logs a resolved response as aborted after its request is cancelled', async () => {
    const historyRequest =
      createDeferred<ITradingViewNativeHistoryResponse | null>();
    mockFetchHistory.mockReturnValue(historyRequest.promise);

    const { unmount } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );
    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(1));
    const request = mockFetchHistory.mock.calls[0]?.[0];

    unmount();
    expect(request?.signal.aborted).toBe(true);
    mockEmitTradingViewNativeDebugEvent.mockClear();
    historyRequest.resolve({
      ...buildResponse(100, 100_000),
      historySource: 'fallback',
    });

    await waitFor(() =>
      expect(mockEmitTradingViewNativeDebugEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({ historySource: 'fallback' }),
          level: 'warning',
          name: 'history.response.aborted',
        }),
      ),
    );
    expect(
      mockEmitTradingViewNativeDebugEvent.mock.calls.some(
        ([event]) =>
          event.name === 'history.response' ||
          event.name === 'history.fallback.used',
      ),
    ).toBe(false);
  });

  it('selects a line chart from single-value history metadata', async () => {
    mockHistoryBatchSize = 2;
    mockHistoryRequestCandleCount = 2;
    mockFetchHistory.mockResolvedValue({
      ...buildMultiPointResponse([
        { close: 100, timestamp: 96_400 },
        { close: 110, timestamp: 100_000 },
      ]),
      pointType: 'single',
    });

    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(2));
    expect(result.current.chartType).toBe('line');
  });

  it('selects a line chart from single-value fallback history metadata', async () => {
    mockHistoryBatchSize = 2;
    mockHistoryRequestCandleCount = 2;
    mockFetchHistory.mockResolvedValue({
      ...buildMultiPointResponse([
        { close: 100, timestamp: 96_400 },
        { close: 110, timestamp: 100_000 },
      ]),
      historySource: 'fallback',
      pointType: 'single',
    });

    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(2));
    expect(result.current.chartType).toBe('line');
  });

  it('retains a line chart when foreground refresh returns OHLC history', async () => {
    mockHistoryBatchSize = 2;
    mockHistoryRequestCandleCount = 2;
    mockFetchHistory
      .mockResolvedValueOnce({
        ...buildMultiPointResponse([
          { close: 100, timestamp: 96_400 },
          { close: 110, timestamp: 100_000 },
        ]),
        pointType: 'single',
      })
      .mockResolvedValueOnce(
        buildMultiPointResponse([
          { close: 101, timestamp: 96_400 },
          { close: 111, timestamp: 100_000 },
        ]),
      );

    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.chartType).toBe('line'));
    updateVisibility(false);
    updateVisibility(true);

    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(2));
    expect(result.current.chartType).toBe('line');
  });

  it('does not splice primary history into CoinGecko fallback history', async () => {
    mockHistoryBatchSize = 2;
    mockHistoryRequestCandleCount = 2;
    mockFetchHistory
      .mockResolvedValueOnce({
        ...buildMultiPointResponse([
          { close: 100, timestamp: 96_400 },
          { close: 110, timestamp: 100_000 },
        ]),
        historySource: 'fallback',
        pointType: 'single',
      })
      .mockResolvedValueOnce(
        buildMultiPointResponse([
          { close: 101, timestamp: 96_400 },
          { close: 111, timestamp: 100_000 },
        ]),
      );

    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.chartType).toBe('line'));
    updateVisibility(false);
    updateVisibility(true);

    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(2));
    expect(result.current.chartType).toBe('line');
    expect(result.current.points.map((point) => point.c)).toEqual([100, 110]);
  });

  it('restores the saved interval before the initial history request', async () => {
    mockReadTradingViewNativeActiveInterval.mockReturnValue('15');
    mockFetchHistory.mockResolvedValue(buildResponse(100, 100_000));

    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(1));
    expect(result.current.intervalConfig.activeInterval).toBe('15');
    expect(mockFetchHistory.mock.calls[0]?.[0].interval.value).toBe('15');
    expect(mockReadTradingViewNativeActiveInterval).toHaveBeenCalledTimes(1);
    expect(mockReadTradingViewNativeActiveInterval).toHaveBeenCalledWith(
      'token',
    );
  });

  it('restores a new source namespace before effects can persist the old interval', async () => {
    mockReadTradingViewNativeActiveInterval.mockImplementation((namespace) =>
      namespace === 'native' ? '240' : '15',
    );
    mockFetchHistory.mockResolvedValue(buildResponse(100, 100_000));
    const { result, rerender } = renderHook(
      ({ isNative }: { isNative: boolean }) =>
        useTradingViewNativeKLine({
          source: buildMarketSource({
            isNative,
            tokenAddress: '0xeeee',
          }),
        }),
      { initialProps: { isNative: false } },
    );

    await waitFor(() => expect(result.current.points).toHaveLength(1));
    mockSaveTradingViewNativeActiveInterval.mockClear();
    rerender({ isNative: true });

    expect(result.current.intervalConfig.activeInterval).toBe('240');
    expect(result.current.dataProviderKey).toBe('market:evm--1:0xeeee:native');
    expect(result.current.points).toEqual([]);
    expect(mockSaveTradingViewNativeActiveInterval).not.toHaveBeenCalledWith({
      interval: '15',
      namespace: 'native',
    });
    await waitFor(() =>
      expect(mockSaveTradingViewNativeActiveInterval).toHaveBeenCalledWith({
        interval: '240',
        namespace: 'native',
      }),
    );
  });

  it('persists an interval after its candles are displayed', async () => {
    mockFetchHistory
      .mockResolvedValueOnce(buildResponse(100, 100_000))
      .mockResolvedValueOnce(buildResponse(110, 200_000));
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points[0]?.c).toBe(100));
    mockSaveTradingViewNativeActiveInterval.mockClear();
    act(() => result.current.handleIntervalChange('15'));
    await waitFor(() => expect(result.current.points[0]?.c).toBe(110));

    expect(mockSaveTradingViewNativeActiveInterval).toHaveBeenLastCalledWith({
      interval: '15',
      namespace: 'token',
    });
  });

  it('refines the weekly history boundary with daily data and caches it for 24 hours', async () => {
    let now = 200_000_000;
    mockHistoryBatchSize = 2;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    mockFetchHistory.mockImplementation(async ({ interval }) => {
      if (interval.value === '1W') {
        return buildResponse(80, 100_000);
      }
      if (interval.value === '1D') {
        return buildResponse(90, 110_000);
      }
      return buildResponse(100, 200_000);
    });
    const { rerender, result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(1));
    act(() => result.current.handleHistoryBoundaryPrefetch());
    await waitFor(() =>
      expect(
        mockFetchHistory.mock.calls.filter(
          ([request]) => request.interval.value === '1W',
        ),
      ).toHaveLength(1),
    );
    expect(
      mockFetchHistory.mock.calls.find(
        ([request]) => request.interval.value === '1W',
      )?.[0],
    ).toEqual(
      expect.objectContaining({
        timeFrom: 0,
        timeTo: 200_000,
      }),
    );
    await waitFor(() =>
      expect(result.current.calendarAvailableTimeRange).toEqual({
        from: 110_000,
      }),
    );
    const availableTimeRange = result.current.calendarAvailableTimeRange;
    rerender();
    expect(result.current.calendarAvailableTimeRange).toBe(availableTimeRange);
    expect(
      mockFetchHistory.mock.calls.find(
        ([request]) => request.interval.value === '1D',
      )?.[0],
    ).toEqual(
      expect.objectContaining({
        timeFrom: 13_600,
        timeTo: 200_000,
      }),
    );

    now += 24 * 60 * 60 * 1000 - 1;
    act(() => result.current.handleHistoryBoundaryPrefetch());
    await act(async () => Promise.resolve());
    expect(
      mockFetchHistory.mock.calls.filter(
        ([request]) => request.interval.value === '1W',
      ),
    ).toHaveLength(1);
    expect(
      mockFetchHistory.mock.calls.filter(
        ([request]) => request.interval.value === '1D',
      ),
    ).toHaveLength(1);

    now += 2;
    act(() => result.current.handleHistoryBoundaryPrefetch());
    await waitFor(() =>
      expect(
        mockFetchHistory.mock.calls.filter(
          ([request]) => request.interval.value === '1W',
        ),
      ).toHaveLength(2),
    );
    await waitFor(() =>
      expect(
        mockFetchHistory.mock.calls.filter(
          ([request]) => request.interval.value === '1D',
        ),
      ).toHaveLength(2),
    );
  });

  it('paginates a truncated weekly page before exposing the daily boundary', async () => {
    mockHistoryBatchSize = 1;
    mockFetchHistory.mockImplementation(async ({ interval }) =>
      interval.value === '1W'
        ? buildResponse(80, 100_000)
        : buildResponse(100, 200_000),
    );
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(1));
    act(() => result.current.handleHistoryBoundaryPrefetch());
    await waitFor(() =>
      expect(
        mockFetchHistory.mock.calls.filter(
          ([request]) => request.interval.value === '1W',
        ),
      ).toHaveLength(2),
    );
    await waitFor(() =>
      expect(result.current.calendarAvailableTimeRange).toEqual({
        from: 200_000,
      }),
    );
    expect(
      mockFetchHistory.mock.calls.filter(
        ([request]) => request.interval.value === '1D',
      ),
    ).toHaveLength(1);
  });

  it('does not cache a failed daily boundary refinement', async () => {
    jest.useFakeTimers();
    let dailyRequestCount = 0;
    mockFetchHistory.mockImplementation(async ({ interval }) => {
      if (interval.value === '1W') {
        return buildResponse(80, 100_000);
      }
      if (interval.value === '1D') {
        dailyRequestCount += 1;
        return dailyRequestCount <= 3 ? null : buildResponse(90, 110_000);
      }
      return buildResponse(100, 200_000);
    });
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await act(async () => Promise.resolve());
    act(() => result.current.handleHistoryBoundaryPrefetch());
    await act(async () => {
      await jest.advanceTimersByTimeAsync(4001);
    });
    expect(dailyRequestCount).toBe(3);
    expect(result.current.calendarAvailableTimeRange).toBeUndefined();

    act(() => result.current.handleHistoryBoundaryPrefetch());
    await act(async () => Promise.resolve());
    expect(dailyRequestCount).toBe(4);
    expect(result.current.calendarAvailableTimeRange).toEqual({
      from: 110_000,
    });
  });

  it.each([
    ['1', 60],
    ['5', 5 * 60],
  ] as const)(
    'backfills %s-minute Market history after a sparse initial page',
    async (activeInterval, intervalSeconds) => {
      const initialTimestamp = 1_000_000;
      const boundaryTimestamp = initialTimestamp - 2000 * intervalSeconds;
      const historicalPoints = Array.from({ length: 196 }, (_, index) => ({
        close: 70 + index,
        timestamp: initialTimestamp - (196 - index) * intervalSeconds,
      }));
      mockHistoryBatchSize = 299;
      mockHistoryRequestCandleCount = 2000;
      mockReadTradingViewNativeActiveInterval.mockReturnValue(activeInterval);
      let activeIntervalRequestCount = 0;
      mockFetchHistory.mockImplementation(
        async ({ interval, timeFrom, timeTo }) => {
          if (interval.value === '1W') {
            return buildResponse(50, boundaryTimestamp - 3600);
          }
          if (interval.value === '1D') {
            return buildResponse(60, boundaryTimestamp);
          }

          activeIntervalRequestCount += 1;
          if (activeIntervalRequestCount === 1) {
            return buildMultiPointResponse([
              { close: 100, timestamp: initialTimestamp },
              { close: 110, timestamp: initialTimestamp + intervalSeconds },
            ]);
          }
          expect({ timeFrom, timeTo }).toEqual({
            timeFrom: boundaryTimestamp,
            timeTo: initialTimestamp - 1,
          });
          return buildMultiPointResponse(
            historicalPoints.filter(
              (point) =>
                point.timestamp >= timeFrom && point.timestamp <= timeTo,
            ),
          );
        },
      );
      const { result } = renderHook(() =>
        useTradingViewNativeKLine({ source: buildMarketSource() }),
      );

      await waitFor(() => expect(result.current.points).toHaveLength(198));
      expect(mockFetchHistory).toHaveBeenCalledTimes(4);
      expect(activeIntervalRequestCount).toBe(2);
      expect(result.current.points[0]?.t).toBe(historicalPoints[0]?.timestamp);
    },
  );

  it('continues through short and empty time windows until the next-screen target', async () => {
    const intervalSeconds = 60;
    const initialTimestamp = 1_000_000;
    const requestCandleCount = 200;
    const firstRange = { timeFrom: 987_999, timeTo: 999_999 };
    const secondRange = { timeFrom: 975_998, timeTo: 987_998 };
    const thirdRange = { timeFrom: 963_997, timeTo: 975_997 };
    const boundaryTimestamp = 900_000;
    const firstRangePoints = Array.from({ length: 22 }, (_, index) => ({
      close: 70 + index,
      timestamp: firstRange.timeFrom + 1 + index * intervalSeconds,
    }));
    const thirdRangePoints = Array.from({ length: 169 }, (_, index) => ({
      close: 100 + index,
      timestamp: thirdRange.timeFrom + 1 + index * intervalSeconds,
    }));
    const nextLoadMoreRequest =
      createDeferred<ITradingViewNativeHistoryResponse | null>();
    mockHistoryBatchSize = 299;
    mockHistoryRequestCandleCount = requestCandleCount;
    mockReadTradingViewNativeActiveInterval.mockReturnValue('1');
    let activeIntervalRequestCount = 0;
    mockFetchHistory.mockImplementation(
      async ({ interval, timeFrom, timeTo }) => {
        if (interval.value === '1W') {
          return buildResponse(50, boundaryTimestamp - 3600);
        }
        if (interval.value === '1D') {
          return buildResponse(60, boundaryTimestamp);
        }

        activeIntervalRequestCount += 1;
        if (activeIntervalRequestCount === 1) {
          return buildMultiPointResponse(
            Array.from({ length: 7 }, (_, index) => ({
              close: 100 + index,
              timestamp: initialTimestamp + index * intervalSeconds,
            })),
          );
        }
        if (activeIntervalRequestCount === 2) {
          expect({ timeFrom, timeTo }).toEqual(firstRange);
          return buildMultiPointResponse(firstRangePoints);
        }
        if (activeIntervalRequestCount === 3) {
          expect({ timeFrom, timeTo }).toEqual(secondRange);
          return { points: [], total: 0 };
        }
        if (activeIntervalRequestCount === 4) {
          expect({ timeFrom, timeTo }).toEqual(thirdRange);
          return buildMultiPointResponse(thirdRangePoints);
        }
        return nextLoadMoreRequest.promise;
      },
    );
    const { result, unmount } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(198));
    expect(activeIntervalRequestCount).toBe(4);
    expect(result.current.points[0]?.t).toBe(thirdRangePoints[0]?.timestamp);

    act(() =>
      result.current.handleVisiblePointRangeChange({
        endIndex: result.current.points.length,
        startIndex: 0,
      }),
    );
    await waitFor(() => expect(activeIntervalRequestCount).toBe(5));
    expect(
      mockFetchHistory.mock.calls.filter(
        ([request]) => request.interval.value === '1',
      )[4]?.[0],
    ).toEqual(
      expect.objectContaining({
        timeTo: thirdRange.timeFrom - 1,
      }),
    );

    unmount();
  });

  it('continues sparse recovery after dropping a fallback response', async () => {
    const intervalSeconds = 60;
    const initialTimestamp = 1_000_000;
    const boundaryTimestamp = 900_000;
    mockHistoryBatchSize = 299;
    mockHistoryRequestCandleCount = 200;
    mockReadTradingViewNativeActiveInterval.mockReturnValue('1');
    let activeIntervalRequestCount = 0;
    mockFetchHistory.mockImplementation(
      async ({ interval, timeFrom, timeTo }) => {
        if (interval.value === '1W') {
          return buildResponse(50, boundaryTimestamp - 3600);
        }
        if (interval.value === '1D') {
          return buildResponse(60, boundaryTimestamp);
        }

        activeIntervalRequestCount += 1;
        if (activeIntervalRequestCount === 1) {
          return buildMultiPointResponse(
            Array.from({ length: 7 }, (_, index) => ({
              close: 100 + index,
              timestamp: initialTimestamp + index * intervalSeconds,
            })),
          );
        }
        if (activeIntervalRequestCount === 2) {
          return {
            ...buildResponse(80, timeFrom + 1),
            historySource: 'fallback',
          };
        }
        return buildMultiPointResponse(
          Array.from({ length: 191 }, (_, index) => ({
            close: 70 + index,
            timestamp: timeFrom + 1 + index * intervalSeconds,
          })).filter(
            (point) => point.timestamp >= timeFrom && point.timestamp <= timeTo,
          ),
        );
      },
    );
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(198));
    expect(activeIntervalRequestCount).toBe(3);
  });

  it('uses the earliest candle in a capped boundary page as the next cursor', async () => {
    const intervalSeconds = 60;
    const initialTimestamp = 1_000_000;
    const boundaryTimestamp = 800_000;
    const cappedPoints = Array.from({ length: 299 }, (_, index) => ({
      close: 70 + index,
      timestamp: 880_100 + index * 400,
    }));
    const nextLoadMoreRequest =
      createDeferred<ITradingViewNativeHistoryResponse | null>();
    mockHistoryBatchSize = 299;
    mockHistoryRequestCandleCount = 2000;
    mockReadTradingViewNativeActiveInterval.mockReturnValue('1');
    let activeIntervalRequestCount = 0;
    mockFetchHistory.mockImplementation(
      async ({ interval, timeFrom, timeTo }) => {
        if (interval.value === '1W') {
          return buildResponse(50, boundaryTimestamp - 3600);
        }
        if (interval.value === '1D') {
          return buildResponse(60, boundaryTimestamp);
        }

        activeIntervalRequestCount += 1;
        if (activeIntervalRequestCount === 1) {
          return buildMultiPointResponse(
            Array.from({ length: 7 }, (_, index) => ({
              close: 100 + index,
              timestamp: initialTimestamp + index * intervalSeconds,
            })),
          );
        }
        if (activeIntervalRequestCount === 2) {
          expect({ timeFrom, timeTo }).toEqual({
            timeFrom: 879_999,
            timeTo: initialTimestamp - 1,
          });
          return buildMultiPointResponse(cappedPoints);
        }
        return nextLoadMoreRequest.promise;
      },
    );
    const { result, unmount } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(306));
    expect(activeIntervalRequestCount).toBe(2);

    act(() =>
      result.current.handleVisiblePointRangeChange({
        endIndex: result.current.points.length,
        startIndex: 0,
      }),
    );
    await waitFor(() => expect(activeIntervalRequestCount).toBe(3));
    const activeIntervalRequests = mockFetchHistory.mock.calls
      .map(([request]) => request)
      .filter((request) => request.interval.value === '1');
    expect(activeIntervalRequests[2]).toEqual(
      expect.objectContaining({
        timeTo: (cappedPoints[0]?.timestamp ?? 0) - 1,
      }),
    );

    unmount();
  });

  it('stops a recovery batch after twenty-five consecutive empty time windows', async () => {
    const initialTimestamp = 1_000_000;
    const boundaryTimestamp = 900_000;
    mockHistoryBatchSize = 299;
    mockHistoryRequestCandleCount = 2;
    mockReadTradingViewNativeActiveInterval.mockReturnValue('1');
    const resumedLoadMoreRequest =
      createDeferred<ITradingViewNativeHistoryResponse | null>();
    let activeIntervalRequestCount = 0;
    mockFetchHistory.mockImplementation(async ({ interval }) => {
      if (interval.value === '1W') {
        return buildResponse(50, boundaryTimestamp - 3600);
      }
      if (interval.value === '1D') {
        return buildResponse(60, boundaryTimestamp);
      }

      activeIntervalRequestCount += 1;
      if (activeIntervalRequestCount === 1) {
        return buildMultiPointResponse([
          { close: 100, timestamp: initialTimestamp },
          { close: 110, timestamp: initialTimestamp + 60 },
        ]);
      }
      if (activeIntervalRequestCount === 27) {
        return resumedLoadMoreRequest.promise;
      }
      return { points: [], total: 0 };
    });
    const { result, unmount } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(activeIntervalRequestCount).toBe(26));
    expect(result.current.points).toHaveLength(2);
    expect(result.current.calendarAvailableTimeRange).toEqual({
      from: boundaryTimestamp,
    });
    const recoveryRequests = mockFetchHistory.mock.calls
      .map(([request]) => request)
      .filter((request) => request.interval.value === '1')
      .slice(1);
    expect(recoveryRequests).toHaveLength(25);
    recoveryRequests.slice(1).forEach((request, index) => {
      expect(request.timeTo).toBe(recoveryRequests[index].timeFrom - 1);
    });
    expect(recoveryRequests.at(-1)?.timeFrom).toBe(996_975);
    expect(recoveryRequests.at(-1)?.timeFrom).toBeGreaterThan(
      boundaryTimestamp,
    );

    act(() => result.current.handleVisiblePointRangeChange({ startIndex: 0 }));
    await waitFor(() => expect(activeIntervalRequestCount).toBe(27));
    expect(
      mockFetchHistory.mock.calls.filter(
        ([request]) => request.interval.value === '1',
      )[26]?.[0],
    ).toEqual(
      expect.objectContaining({
        timeTo: 996_974,
      }),
    );

    unmount();
  });

  it('resets the consecutive empty-window limit after receiving a candle', async () => {
    const initialTimestamp = 1_000_000;
    const boundaryTimestamp = 900_000;
    mockHistoryBatchSize = 299;
    mockHistoryRequestCandleCount = 2;
    mockReadTradingViewNativeActiveInterval.mockReturnValue('1');
    let activeIntervalRequestCount = 0;
    mockFetchHistory.mockImplementation(async ({ interval, timeFrom }) => {
      if (interval.value === '1W') {
        return buildResponse(50, boundaryTimestamp - 3600);
      }
      if (interval.value === '1D') {
        return buildResponse(60, boundaryTimestamp);
      }

      activeIntervalRequestCount += 1;
      if (activeIntervalRequestCount === 1) {
        return buildMultiPointResponse(
          Array.from({ length: 196 }, (_, index) => ({
            close: 100 + index,
            timestamp: initialTimestamp + index * 60,
          })),
        );
      }
      const recoveryRequestCount = activeIntervalRequestCount - 1;
      if (recoveryRequestCount === 25 || recoveryRequestCount === 50) {
        return buildResponse(70 + recoveryRequestCount, timeFrom + 1);
      }
      return { points: [], total: 0 };
    });
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(198));
    expect(activeIntervalRequestCount).toBe(51);
  });

  it('resets the one-hundred-request limit for each user load-more interaction', async () => {
    const initialTimestamp = 1_000_000;
    const boundaryTimestamp = 100_000;
    mockHistoryBatchSize = 299;
    mockHistoryRequestCandleCount = 2;
    mockReadTradingViewNativeActiveInterval.mockReturnValue('1');
    let activeIntervalRequestCount = 0;
    let sparseWindowRequestCount = 0;
    mockFetchHistory.mockImplementation(async ({ interval, timeFrom }) => {
      if (interval.value === '1W') {
        return buildResponse(50, boundaryTimestamp - 3600);
      }
      if (interval.value === '1D') {
        return buildResponse(60, boundaryTimestamp);
      }

      activeIntervalRequestCount += 1;
      if (activeIntervalRequestCount === 1) {
        return buildMultiPointResponse([
          { close: 100, timestamp: initialTimestamp },
          { close: 110, timestamp: initialTimestamp + 60 },
        ]);
      }

      sparseWindowRequestCount += 1;
      return sparseWindowRequestCount % 25 === 0
        ? buildResponse(70 + sparseWindowRequestCount, timeFrom + 1)
        : { points: [], total: 0 };
    });
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(100), {
      timeout: 5000,
    });
    expect(activeIntervalRequestCount).toBe(98);

    act(() => result.current.handleVisiblePointRangeChange({ startIndex: 0 }));

    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(200), {
      timeout: 5000,
    });
    expect(activeIntervalRequestCount).toBe(198);
  });

  it('counts an empty load-more window toward the twenty-five-window limit', async () => {
    const initialTimestamp = 1_000_000;
    const boundaryTimestamp = 900_000;
    mockHistoryBatchSize = 299;
    mockHistoryRequestCandleCount = 2;
    mockReadTradingViewNativeActiveInterval.mockReturnValue('1');
    let activeIntervalRequestCount = 0;
    mockFetchHistory.mockImplementation(async ({ interval }) => {
      if (interval.value === '1W') {
        return buildResponse(50, boundaryTimestamp - 3600);
      }
      if (interval.value === '1D') {
        return buildResponse(60, boundaryTimestamp);
      }

      activeIntervalRequestCount += 1;
      if (activeIntervalRequestCount === 1) {
        return buildMultiPointResponse(
          Array.from({ length: 299 }, (_, index) => ({
            close: 100 + index,
            timestamp: initialTimestamp + index * 60,
          })),
        );
      }
      return { points: [], total: 0 };
    });
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(299));
    act(() => result.current.handleVisiblePointRangeChange({ startIndex: 0 }));
    await waitFor(() =>
      expect(result.current.calendarAvailableTimeRange).toEqual({
        from: boundaryTimestamp,
      }),
    );

    expect(activeIntervalRequestCount).toBe(26);
    expect(
      mockFetchHistory.mock.calls
        .map(([request]) => request)
        .filter((request) => request.interval.value === '1')
        .slice(2),
    ).toHaveLength(24);
  });

  it.each([
    ['1', 60],
    ['5', 5 * 60],
  ] as const)(
    'continues %s-minute Market load-more after a short non-empty page',
    async (activeInterval, intervalSeconds) => {
      const boundaryTimestamp = 110_000;
      const standardTimeFrom = 999_999 - 99 * intervalSeconds;
      const recoveryTimeTo = standardTimeFrom - 1;
      const recoveryTimeFrom = Math.max(
        recoveryTimeTo - 2000 * intervalSeconds,
        boundaryTimestamp,
      );
      mockHistoryBatchSize = 299;
      mockHistoryRequestCandleCount = 2000;
      mockReadTradingViewNativeActiveInterval.mockReturnValue(activeInterval);
      let activeIntervalRequestCount = 0;
      const recoveryPoints = Array.from({ length: 98 }, (_, index) => ({
        close: 70 + index,
        timestamp: 920_100 + index * intervalSeconds,
      }));
      mockFetchHistory.mockImplementation(
        async ({ interval, timeFrom, timeTo }) => {
          if (interval.value === '1W') {
            return buildResponse(50, 100_000);
          }
          if (interval.value === '1D') {
            return buildResponse(60, boundaryTimestamp);
          }

          activeIntervalRequestCount += 1;
          if (activeIntervalRequestCount === 1) {
            return buildMultiPointResponse(
              Array.from({ length: 299 }, (_, index) => ({
                close: 100 + index,
                timestamp: 1_000_000 + index * intervalSeconds,
              })),
            );
          }
          if (activeIntervalRequestCount === 2) {
            return buildResponse(90, 995_000);
          }
          return buildMultiPointResponse(
            recoveryPoints.filter(
              (point) =>
                point.timestamp >= timeFrom && point.timestamp <= timeTo,
            ),
          );
        },
      );
      const { result } = renderHook(() =>
        useTradingViewNativeKLine({ source: buildMarketSource() }),
      );

      await waitFor(() => expect(result.current.points).toHaveLength(299));
      act(() =>
        result.current.handleVisiblePointRangeChange({ startIndex: 0 }),
      );

      await waitFor(() => expect(result.current.points).toHaveLength(398));
      expect(result.current.points[0]?.t).toBe(920_100);
      expect(
        mockFetchHistory.mock.calls.filter(
          ([request]) => request.interval.value === activeInterval,
        )[2]?.[0],
      ).toEqual(
        expect.objectContaining({
          timeFrom: recoveryTimeFrom,
          timeTo: recoveryTimeTo,
        }),
      );
      expect(result.current.points.some((point) => point.t === 995_000)).toBe(
        true,
      );
      expect(mockFetchHistory).toHaveBeenCalledTimes(5);
    },
  );

  it.each([
    ['1', 60],
    ['5', 5 * 60],
  ] as const)(
    'keeps all %s-minute Market history returned beyond the preload target',
    async (activeInterval, intervalSeconds) => {
      const currentTimestamp = 2_000_000;
      const initialFirstTimestamp = currentTimestamp - 298 * intervalSeconds;
      const returnedOlderPointCount = 45;
      const olderFirstTimestamp =
        initialFirstTimestamp - returnedOlderPointCount * intervalSeconds;
      mockHistoryBatchSize = 299;
      mockHistoryRequestCandleCount = 2000;
      mockReadTradingViewNativeActiveInterval.mockReturnValue(activeInterval);
      jest.spyOn(Date, 'now').mockReturnValue(currentTimestamp * 1000);
      mockFetchHistory
        .mockResolvedValueOnce(
          buildMultiPointResponse(
            Array.from({ length: 299 }, (_, index) => ({
              close: 100 + index,
              timestamp: initialFirstTimestamp + index * intervalSeconds,
            })),
          ),
        )
        .mockResolvedValueOnce(
          buildMultiPointResponse(
            Array.from({ length: returnedOlderPointCount }, (_, index) => ({
              close: 70 + index,
              timestamp: olderFirstTimestamp + index * intervalSeconds,
            })),
          ),
        );
      const { result } = renderHook(() =>
        useTradingViewNativeKLine({ source: buildMarketSource() }),
      );

      await waitFor(() => expect(result.current.points).toHaveLength(299));
      act(() =>
        result.current.handleVisiblePointRangeChange({
          endIndex: 91,
          startIndex: 31,
        }),
      );
      expect(mockFetchHistory).toHaveBeenCalledTimes(1);

      act(() =>
        result.current.handleVisiblePointRangeChange({
          endIndex: 90,
          startIndex: 30,
        }),
      );
      await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(2));
      expect(mockFetchHistory.mock.calls[1]?.[0]).toEqual(
        expect.objectContaining({
          timeFrom: initialFirstTimestamp - 30 * intervalSeconds - 1,
          timeTo: initialFirstTimestamp - 1,
        }),
      );
      await waitFor(() =>
        expect(result.current.points).toHaveLength(
          299 + returnedOlderPointCount,
        ),
      );
      expect(result.current.points[0]?.t).toBe(olderFirstTimestamp);
    },
  );

  it('stops sparse Market pagination at the refined daily boundary', async () => {
    mockHistoryBatchSize = 2;
    mockHistoryRequestCandleCount = 2;
    mockReadTradingViewNativeActiveInterval.mockReturnValue('1');
    jest.spyOn(Date, 'now').mockReturnValue(2_000_000_000);
    mockFetchHistory.mockImplementation(async ({ interval }) => {
      if (interval.value === '1W') {
        return buildResponse(50, 100_000);
      }
      if (interval.value === '1D') {
        return buildResponse(60, 110_000);
      }
      if (interval.value === '1') {
        return mockFetchHistory.mock.calls.filter(
          ([request]) => request.interval.value === '1',
        ).length === 1
          ? buildMultiPointResponse([
              { close: 100, timestamp: 110_000 },
              { close: 110, timestamp: 110_060 },
            ])
          : { points: [], total: 0 };
      }
      return { points: [], total: 0 };
    });
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(2));
    act(() => result.current.handleVisiblePointRangeChange({ startIndex: 0 }));
    await waitFor(() =>
      expect(result.current.calendarAvailableTimeRange).toEqual({
        from: 110_000,
      }),
    );
    expect(mockFetchHistory).toHaveBeenCalledTimes(4);

    act(() => result.current.handleVisiblePointRangeChange({ startIndex: 0 }));
    expect(mockFetchHistory).toHaveBeenCalledTimes(4);
  });

  it('keeps sparse pagination retryable after boundary prefetch fails', async () => {
    jest.useFakeTimers();
    mockHistoryBatchSize = 299;
    mockHistoryRequestCandleCount = 2000;
    mockReadTradingViewNativeActiveInterval.mockReturnValue('1');
    let activeIntervalRequestCount = 0;
    let weeklyRequestCount = 0;
    const recoveryPoints = Array.from({ length: 99 }, (_, index) => ({
      close: 70 + index,
      timestamp: 920_100 + index * 60,
    }));
    mockFetchHistory.mockImplementation(
      async ({ interval, timeFrom, timeTo }) => {
        if (interval.value === '1W') {
          weeklyRequestCount += 1;
          return weeklyRequestCount <= 3 ? null : buildResponse(50, 100_000);
        }
        if (interval.value === '1D') {
          return buildResponse(60, 110_000);
        }

        activeIntervalRequestCount += 1;
        if (activeIntervalRequestCount === 1) {
          return buildMultiPointResponse(
            Array.from({ length: 299 }, (_, index) => ({
              close: 100 + index,
              timestamp: 1_000_000 + index * 60,
            })),
          );
        }
        if (activeIntervalRequestCount <= 3) {
          return { points: [], total: 0 };
        }
        return buildMultiPointResponse(
          recoveryPoints.filter(
            (point) => point.timestamp >= timeFrom && point.timestamp <= timeTo,
          ),
        );
      },
    );
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(299));
    act(() => result.current.handleVisiblePointRangeChange({ startIndex: 0 }));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(4001);
    });
    expect(weeklyRequestCount).toBe(3);
    expect(activeIntervalRequestCount).toBe(2);

    act(() => result.current.handleVisiblePointRangeChange({ startIndex: 0 }));
    await waitFor(() => expect(result.current.points).toHaveLength(398));
    expect(weeklyRequestCount).toBe(4);
    expect(activeIntervalRequestCount).toBe(4);
  });

  it('keeps load-more ownership when aborted initial recovery settles', async () => {
    mockHistoryBatchSize = 3;
    mockHistoryRequestCandleCount = 2;
    mockReadTradingViewNativeActiveInterval.mockReturnValue('1');
    jest.spyOn(Date, 'now').mockReturnValue(2_000_000_000);
    const boundaryRequest =
      createDeferred<ITradingViewNativeHistoryResponse | null>();
    const loadMoreRequest =
      createDeferred<ITradingViewNativeHistoryResponse | null>();
    let activeIntervalRequestCount = 0;
    mockFetchHistory.mockImplementation(async ({ interval }) => {
      if (interval.value === '1W') {
        return boundaryRequest.promise;
      }
      if (interval.value === '1D') {
        return buildResponse(60, 110_000);
      }

      activeIntervalRequestCount += 1;
      if (activeIntervalRequestCount === 1) {
        return buildMultiPointResponse([
          { close: 100, timestamp: 1_000_000 },
          { close: 110, timestamp: 1_000_060 },
        ]);
      }
      if (activeIntervalRequestCount === 2) {
        return buildMultiPointResponse([
          { close: 80, timestamp: 900_000 },
          { close: 90, timestamp: 900_060 },
        ]);
      }
      return loadMoreRequest.promise;
    });
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() =>
      expect(
        mockFetchHistory.mock.calls.some(
          ([request]) => request.interval.value === '1W',
        ),
      ).toBe(true),
    );
    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timeRange',
        from: 900_000,
        to: 900_060,
      });
    });
    act(() =>
      result.current.handleViewportRequestApplied(
        result.current.viewportRequest?.requestId ?? 0,
      ),
    );
    act(() => result.current.handleVisiblePointRangeChange({ startIndex: 0 }));
    await waitFor(() => expect(activeIntervalRequestCount).toBe(3));

    await act(async () => {
      boundaryRequest.resolve(buildResponse(50, 100_000));
      await boundaryRequest.promise;
      await Promise.resolve();
    });
    act(() => result.current.handleVisiblePointRangeChange({ startIndex: 0 }));
    await act(async () => Promise.resolve());
    expect(activeIntervalRequestCount).toBe(3);

    await act(async () => {
      loadMoreRequest.resolve(
        buildMultiPointResponse([
          { close: 60, timestamp: 899_000 },
          { close: 70, timestamp: 899_060 },
          { close: 80, timestamp: 899_120 },
        ]),
      );
      await loadMoreRequest.promise;
    });
    await waitFor(() => expect(result.current.points[0]?.t).toBe(899_000));
  });

  it('does not paginate CoinGecko fallback data as Market history', async () => {
    mockHistoryBatchSize = 1;
    mockHistoryRequestCandleCount = 2000;
    mockFetchHistory.mockResolvedValue({
      ...buildResponse(100, 1_000_000),
      historySource: 'fallback',
    });
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(1));
    expect(mockHasMoreHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        historySource: 'fallback',
        receivedPointCount: 1,
      }),
    );

    act(() => result.current.handleVisiblePointRangeChange({ startIndex: 0 }));
    expect(mockFetchHistory).toHaveBeenCalledTimes(1);
  });

  it('loads history around a timestamp before exposing a viewport request', async () => {
    mockHistoryRequestCandleCount = 4;
    mockFetchHistory
      .mockResolvedValueOnce(
        buildMultiPointResponse([
          { close: 100, timestamp: 996_400 },
          { close: 110, timestamp: 1_000_000 },
        ]),
      )
      .mockResolvedValueOnce(buildResponse(80, 500_000))
      .mockResolvedValueOnce(null);
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(2));
    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timestamp',
        timestamp: 500_000,
      });
    });

    expect(mockFetchHistory).toHaveBeenCalledTimes(3);
    expect(mockFetchHistory.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        timeFrom: 492_800,
        timeTo: 507_200,
      }),
    );
    expect(mockFetchHistory.mock.calls[2]?.[0]).toEqual(
      expect.objectContaining({
        timeFrom: 500_001,
        timeTo: 507_200,
      }),
    );
    expect(result.current.points.map((point) => point.t)).toEqual([
      500_000, 996_400, 1_000_000,
    ]);
    expect(result.current.viewportRequest).toEqual(
      expect.objectContaining({
        requestId: 1,
        target: {
          kind: 'timestamp',
          timestamp: 500_000,
        },
      }),
    );
  });

  it('clamps a target before available history to the earliest candle', async () => {
    mockHistoryBatchSize = 3;
    mockHistoryRequestCandleCount = 4;
    mockFetchHistory
      .mockResolvedValueOnce(
        buildMultiPointResponse([
          { close: 100, timestamp: 1_000_000 },
          { close: 110, timestamp: 1_003_600 },
        ]),
      )
      .mockResolvedValueOnce(
        buildMultiPointResponse([
          { close: 70, timestamp: 500_000 },
          { close: 80, timestamp: 503_600 },
        ]),
      )
      .mockResolvedValueOnce(null);
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(2));
    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timestamp',
        timestamp: 100_000,
      });
    });

    expect(mockFetchHistory).toHaveBeenCalledTimes(3);
    expect(mockFetchHistory.mock.calls[2]?.[0]).toEqual(
      expect.objectContaining({
        timeFrom: 503_601,
        timeTo: 507_200,
      }),
    );
    expect(result.current.points.map((point) => point.t)).toEqual([
      500_000, 503_600, 1_000_000, 1_003_600,
    ]);
    expect(result.current.viewportRequest).toEqual(
      expect.objectContaining({
        target: {
          kind: 'timestamp',
          timestamp: 500_000,
        },
      }),
    );
  });

  it('clamps a target after available history to the latest candle', async () => {
    mockFetchHistory.mockResolvedValue(
      buildMultiPointResponse([
        { close: 100, timestamp: 100_000 },
        { close: 110, timestamp: 103_600 },
      ]),
    );
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(2));
    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timestamp',
        timestamp: 200_000,
      });
    });

    expect(result.current.viewportRequest).toEqual(
      expect.objectContaining({
        target: {
          kind: 'timestamp',
          timestamp: 103_600,
        },
      }),
    );
  });

  it('clamps an empty future target response without probing the old boundary', async () => {
    mockFetchHistory
      .mockResolvedValueOnce(
        buildMultiPointResponse([
          { close: 100, timestamp: 100_000 },
          { close: 110, timestamp: 103_600 },
        ]),
      )
      .mockResolvedValueOnce({ points: [], total: 0 });
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(2));
    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timestamp',
        timestamp: 200_000,
      });
    });

    expect(mockFetchHistory).toHaveBeenCalledTimes(2);
    expect(result.current.viewportRequest).toEqual(
      expect.objectContaining({
        target: {
          kind: 'timestamp',
          timestamp: 103_600,
        },
      }),
    );
  });

  it('loads the latest interval page when a future range switches intervals', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(2_000_000_000);
    const currentTimestamp = 2_000_000;
    const latestIntervalTimestamp = currentTimestamp - 300;
    mockHistoryRequestCandleCount = 288;
    mockReadTradingViewNativeActiveInterval.mockReturnValue('1');
    mockHasMoreHistory.mockImplementation(
      ({ interval }) => interval.value === '1',
    );
    mockFetchHistory.mockImplementation(
      async ({ interval, timeFrom, timeTo }) => {
        if (interval.value === '1') {
          return buildResponse(100, currentTimestamp - 60);
        }
        return buildMultiPointResponse(
          [
            {
              close: 110,
              timestamp: latestIntervalTimestamp,
            },
          ].filter(
            ({ timestamp }) => timestamp >= timeFrom && timestamp <= timeTo,
          ),
        );
      },
    );
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(1));
    act(() =>
      result.current.handleIntervalChange('5', {
        skipNextHistoryRequest: true,
      }),
    );
    await waitFor(() =>
      expect(result.current.intervalConfig.activeInterval).toBe('5'),
    );
    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timeRange',
        from: currentTimestamp + 16 * 3600,
        to: currentTimestamp + 24 * 3600,
      });
    });

    expect(mockFetchHistory).toHaveBeenCalledTimes(2);
    expect(mockFetchHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({
        interval: expect.objectContaining({ value: '5' }),
        timeFrom: currentTimestamp - 24 * 3600,
        timeTo: currentTimestamp,
      }),
    );
    expect(result.current.intervalConfig.activeInterval).toBe('5');
    expect(result.current.points.map((point) => point.t)).toEqual([
      latestIntervalTimestamp,
    ]);
    expect(result.current.viewportRequest).toEqual(
      expect.objectContaining({
        target: {
          kind: 'timestamp',
          timestamp: latestIntervalTimestamp,
        },
      }),
    );
    act(() =>
      result.current.handleViewportRequestApplied(
        result.current.viewportRequest?.requestId ?? 0,
      ),
    );
    act(() =>
      result.current.handleVisiblePointRangeChange({
        endIndex: 1,
        startIndex: 0,
      }),
    );
    expect(mockFetchHistory).toHaveBeenCalledTimes(2);
  });

  it('loads the latest interval page for a future range while initial history is pending', async () => {
    const initialHistoryRequest =
      createDeferred<ITradingViewNativeHistoryResponse | null>();
    jest.spyOn(Date, 'now').mockReturnValue(2_000_000_000);
    const currentTimestamp = 2_000_000;
    const latestIntervalTimestamp = currentTimestamp - 300;
    let initialHistorySignal: AbortSignal | undefined;
    mockHistoryRequestCandleCount = 288;
    mockReadTradingViewNativeActiveInterval.mockReturnValue('1');
    mockFetchHistory.mockImplementation(
      async ({ interval, signal, timeFrom, timeTo }) => {
        if (interval.value === '1') {
          initialHistorySignal = signal;
          return initialHistoryRequest.promise;
        }
        return buildFallbackMultiPointResponse(
          [
            {
              close: 110,
              timestamp: latestIntervalTimestamp,
            },
          ].filter(
            ({ timestamp }) => timestamp >= timeFrom && timestamp <= timeTo,
          ),
        );
      },
    );
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(initialHistorySignal).toBeDefined());
    act(() =>
      result.current.handleIntervalChange('5', {
        skipNextHistoryRequest: true,
      }),
    );
    await waitFor(() =>
      expect(result.current.intervalConfig.activeInterval).toBe('5'),
    );
    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timeRange',
        from: currentTimestamp + 16 * 3600,
        to: currentTimestamp + 24 * 3600,
      });
    });

    expect(initialHistorySignal?.aborted).toBe(true);
    expect(mockFetchHistory).toHaveBeenCalledTimes(2);
    expect(result.current.isSwitchingInterval).toBe(false);
    expect(result.current.points.map((point) => point.t)).toEqual([
      latestIntervalTimestamp,
    ]);
    expect(result.current.viewportRequest).toEqual(
      expect.objectContaining({
        target: {
          kind: 'timestamp',
          timestamp: latestIntervalTimestamp,
        },
      }),
    );
  });

  it('loads a later historical range instead of the latest page after an earlier historical jump', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(2_000_000_000);
    const currentTimestamp = 2_000_000;
    const firstHistoricalRange = {
      from: 500_000,
      to: 503_600,
    };
    const secondHistoricalRange = {
      from: 1_000_000,
      to: 1_003_600,
    };
    const latestIntervalTimestamp = currentTimestamp - 900;
    mockHistoryRequestCandleCount = 288;
    mockReadTradingViewNativeActiveInterval.mockReturnValue('1');
    mockFetchHistory.mockImplementation(
      async ({ interval, timeFrom, timeTo }) => {
        if (interval.value === '1') {
          return buildResponse(100, currentTimestamp - 60);
        }
        const availableCandles =
          interval.value === '5'
            ? [
                { close: 70, timestamp: firstHistoricalRange.from },
                { close: 80, timestamp: firstHistoricalRange.to },
              ]
            : [
                { close: 90, timestamp: secondHistoricalRange.from },
                { close: 100, timestamp: secondHistoricalRange.to },
                { close: 110, timestamp: latestIntervalTimestamp },
              ];
        return buildMultiPointResponse(
          availableCandles.filter(
            ({ timestamp }) => timestamp >= timeFrom && timestamp <= timeTo,
          ),
        );
      },
    );
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(1));
    act(() =>
      result.current.handleIntervalChange('5', {
        skipNextHistoryRequest: true,
      }),
    );
    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timeRange',
        ...firstHistoricalRange,
      });
    });
    expect(result.current.points.map((point) => point.t)).toEqual([
      firstHistoricalRange.from,
      firstHistoricalRange.to,
    ]);

    act(() =>
      result.current.handleIntervalChange('15', {
        skipNextHistoryRequest: true,
      }),
    );
    await waitFor(() =>
      expect(result.current.intervalConfig.activeInterval).toBe('15'),
    );
    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timeRange',
        ...secondHistoricalRange,
      });
    });

    expect(mockFetchHistory).toHaveBeenCalledTimes(3);
    expect(mockFetchHistory.mock.calls[2]?.[0]).toEqual(
      expect.objectContaining({
        interval: expect.objectContaining({ value: '15' }),
        timeFrom: secondHistoricalRange.from - 900,
        timeTo: secondHistoricalRange.to + 900,
      }),
    );
    expect(result.current.points.map((point) => point.t)).toEqual([
      secondHistoricalRange.from,
      secondHistoricalRange.to,
    ]);
    expect(result.current.viewportRequest).toEqual(
      expect.objectContaining({
        target: {
          kind: 'timeRange',
          ...secondHistoricalRange,
        },
      }),
    );
  });

  it('loads the latest page for a future range after a historical jump keeps the same interval', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(2_000_000_000);
    const currentTimestamp = 2_000_000;
    const historicalRange = {
      from: 500_000,
      to: 503_600,
    };
    const latestCandles = Array.from({ length: 50 }, (_, index) => ({
      close: 100 + index,
      timestamp: currentTimestamp - (50 - index) * 900,
    }));
    const latestIntervalTimestamp =
      latestCandles[latestCandles.length - 1]?.timestamp;
    mockHistoryRequestCandleCount = 288;
    mockReadTradingViewNativeActiveInterval.mockReturnValue('1');
    mockFetchHistory.mockImplementation(
      async ({ interval, timeFrom, timeTo }) => {
        if (interval.value === '1') {
          return buildResponse(100, currentTimestamp - 60);
        }
        const filteredCandles = [
          { close: 70, timestamp: historicalRange.from },
          { close: 80, timestamp: historicalRange.to },
          ...latestCandles,
        ].filter(
          ({ timestamp }) => timestamp >= timeFrom && timestamp <= timeTo,
        );
        return buildMultiPointResponse(filteredCandles);
      },
    );
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(1));
    act(() =>
      result.current.handleIntervalChange('15', {
        skipNextHistoryRequest: true,
      }),
    );
    await waitFor(() =>
      expect(result.current.intervalConfig.activeInterval).toBe('15'),
    );
    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timeRange',
        ...historicalRange,
      });
    });
    act(() =>
      result.current.handleViewportRequestApplied(
        result.current.viewportRequest?.requestId ?? 0,
      ),
    );
    expect(result.current.points.map((point) => point.t)).toEqual([
      historicalRange.from,
      historicalRange.to,
    ]);

    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timeRange',
        from: currentTimestamp + 16 * 3600,
        to: currentTimestamp + 24 * 3600,
      });
    });

    expect(mockFetchHistory).toHaveBeenCalledTimes(3);
    expect(mockFetchHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({
        interval: expect.objectContaining({ value: '15' }),
        timeFrom: currentTimestamp - 288 * 900,
        timeTo: currentTimestamp,
      }),
    );
    expect(result.current.viewportRequest).toEqual(
      expect.objectContaining({
        target: {
          kind: 'timestamp',
          timestamp: latestIntervalTimestamp,
        },
      }),
    );
    expect(result.current.points).toHaveLength(52);

    act(() =>
      result.current.handleViewportRequestApplied(
        result.current.viewportRequest?.requestId ?? 0,
      ),
    );
    act(() =>
      result.current.handleVisiblePointRangeChange({
        endIndex: result.current.points.length,
        startIndex: result.current.points.length - 10,
      }),
    );
    expect(mockFetchHistory).toHaveBeenCalledTimes(3);
  });

  it('merges a realtime candle that arrives while a future latest page is loading', async () => {
    const latestHistoryRequest =
      createDeferred<ITradingViewNativeHistoryResponse | null>();
    jest.spyOn(Date, 'now').mockReturnValue(2_000_000_000);
    const currentTimestamp = 2_000_000;
    const historicalRange = {
      from: 500_000,
      to: 503_600,
    };
    const latestHistoryCandles = Array.from({ length: 50 }, (_, index) => ({
      close: 100 + index,
      timestamp: currentTimestamp - (51 - index) * 900,
    }));
    const realtimePoint = {
      o: 200,
      h: 202,
      l: 199,
      c: 201,
      v: 12,
      t: currentTimestamp - 900,
    };
    mockHistoryRequestCandleCount = 288;
    mockReadTradingViewNativeActiveInterval.mockReturnValue('1');
    mockFetchHistory.mockImplementation(
      async ({ interval, timeFrom, timeTo }) => {
        if (interval.value === '1') {
          return buildResponse(100, currentTimestamp - 60);
        }
        if (timeTo === currentTimestamp) {
          return latestHistoryRequest.promise;
        }
        return buildMultiPointResponse(
          [
            { close: 70, timestamp: historicalRange.from },
            { close: 80, timestamp: historicalRange.to },
          ].filter(
            ({ timestamp }) => timestamp >= timeFrom && timestamp <= timeTo,
          ),
        );
      },
    );
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({
        source: buildMarketSource({ realtime: 'websocket' }),
      }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(1));
    await waitFor(() => expect(mockSubscribeRealtime).toHaveBeenCalledTimes(1));
    act(() =>
      result.current.handleIntervalChange('15', {
        skipNextHistoryRequest: true,
      }),
    );
    await waitFor(() =>
      expect(result.current.intervalConfig.activeInterval).toBe('15'),
    );
    await waitFor(() => expect(mockSubscribeRealtime).toHaveBeenCalledTimes(2));
    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timeRange',
        ...historicalRange,
      });
    });
    act(() =>
      result.current.handleViewportRequestApplied(
        result.current.viewportRequest?.requestId ?? 0,
      ),
    );

    let navigationPromise = Promise.resolve();
    act(() => {
      navigationPromise = result.current.handleViewportTargetChange({
        kind: 'timeRange',
        from: currentTimestamp + 16 * 3600,
        to: currentTimestamp + 24 * 3600,
      });
    });
    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(3));
    pushRealtimePoint(realtimePoint);
    expect(result.current.points.map((point) => point.t)).toEqual([
      historicalRange.from,
      historicalRange.to,
    ]);

    await act(async () => {
      latestHistoryRequest.resolve(
        buildMultiPointResponse(latestHistoryCandles),
      );
      await navigationPromise;
    });

    expect(result.current.points[result.current.points.length - 1]).toEqual(
      realtimePoint,
    );
    expect(result.current.viewportRequest).toEqual(
      expect.objectContaining({
        target: {
          kind: 'timestamp',
          timestamp: realtimePoint.t,
        },
      }),
    );
    act(() =>
      result.current.handleViewportRequestApplied(
        result.current.viewportRequest?.requestId ?? 0,
      ),
    );
    act(() =>
      result.current.handleVisiblePointRangeChange({
        endIndex: result.current.points.length,
        startIndex: result.current.points.length - 10,
      }),
    );
    expect(mockFetchHistory).toHaveBeenCalledTimes(3);
  });

  it('uses a buffered realtime candle when a future latest page is empty', async () => {
    const latestHistoryRequest =
      createDeferred<ITradingViewNativeHistoryResponse | null>();
    jest.spyOn(Date, 'now').mockReturnValue(2_000_000_000);
    const currentTimestamp = 2_000_000;
    const historicalRange = {
      from: 500_000,
      to: 503_600,
    };
    const realtimePoint = {
      o: 200,
      h: 202,
      l: 199,
      c: 201,
      v: 12,
      t: currentTimestamp - 900,
    };
    mockHistoryRequestCandleCount = 288;
    mockReadTradingViewNativeActiveInterval.mockReturnValue('1');
    mockFetchHistory.mockImplementation(
      async ({ interval, timeFrom, timeTo }) => {
        if (interval.value === '1') {
          return buildResponse(100, currentTimestamp - 60);
        }
        if (timeTo === currentTimestamp) {
          return latestHistoryRequest.promise;
        }
        return buildMultiPointResponse(
          [
            { close: 70, timestamp: historicalRange.from },
            { close: 80, timestamp: historicalRange.to },
          ].filter(
            ({ timestamp }) => timestamp >= timeFrom && timestamp <= timeTo,
          ),
        );
      },
    );
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({
        source: buildMarketSource({ realtime: 'websocket' }),
      }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(1));
    await waitFor(() => expect(mockSubscribeRealtime).toHaveBeenCalledTimes(1));
    act(() =>
      result.current.handleIntervalChange('15', {
        skipNextHistoryRequest: true,
      }),
    );
    await waitFor(() =>
      expect(result.current.intervalConfig.activeInterval).toBe('15'),
    );
    await waitFor(() => expect(mockSubscribeRealtime).toHaveBeenCalledTimes(2));
    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timeRange',
        ...historicalRange,
      });
    });
    act(() =>
      result.current.handleViewportRequestApplied(
        result.current.viewportRequest?.requestId ?? 0,
      ),
    );

    let navigationPromise = Promise.resolve();
    act(() => {
      navigationPromise = result.current.handleViewportTargetChange({
        kind: 'timeRange',
        from: currentTimestamp + 16 * 3600,
        to: currentTimestamp + 24 * 3600,
      });
    });
    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(3));
    pushRealtimePoint(realtimePoint);

    await act(async () => {
      latestHistoryRequest.resolve({ points: [], total: 0 });
      await navigationPromise;
    });

    expect(mockFetchHistory).toHaveBeenCalledTimes(3);
    expect(result.current.points[result.current.points.length - 1]).toEqual(
      realtimePoint,
    );
    expect(result.current.viewportRequest).toEqual(
      expect.objectContaining({
        target: {
          kind: 'timestamp',
          timestamp: realtimePoint.t,
        },
      }),
    );
  });

  it('discards realtime before history when a future request crosses an interval boundary', async () => {
    const latestHistoryRequest =
      createDeferred<ITradingViewNativeHistoryResponse | null>();
    let currentTimeMilliseconds = 2_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => currentTimeMilliseconds);
    const currentTimestamp = 2_000_000;
    const realtimePoint = {
      o: 200,
      h: 202,
      l: 199,
      c: 201,
      v: 12,
      t: currentTimestamp + 900,
    };
    mockHistoryRequestCandleCount = 288;
    mockReadTradingViewNativeActiveInterval.mockReturnValue('1');
    mockFetchHistory.mockImplementation(async ({ interval }) =>
      interval.value === '1'
        ? buildResponse(100, currentTimestamp - 60)
        : latestHistoryRequest.promise,
    );
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({
        source: buildMarketSource({ realtime: 'websocket' }),
      }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(1));
    await waitFor(() => expect(mockSubscribeRealtime).toHaveBeenCalledTimes(1));
    act(() =>
      result.current.handleIntervalChange('15', {
        skipNextHistoryRequest: true,
      }),
    );
    await waitFor(() =>
      expect(result.current.intervalConfig.activeInterval).toBe('15'),
    );
    await waitFor(() => expect(mockSubscribeRealtime).toHaveBeenCalledTimes(2));

    let navigationPromise = Promise.resolve();
    act(() => {
      navigationPromise = result.current.handleViewportTargetChange({
        kind: 'timeRange',
        from: currentTimestamp + 16 * 3600,
        to: currentTimestamp + 24 * 3600,
      });
    });
    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(2));
    currentTimeMilliseconds = realtimePoint.t * 1000;
    pushRealtimePoint(realtimePoint);

    await act(async () => {
      latestHistoryRequest.resolve({ points: [], total: 0 });
      await navigationPromise;
    });

    expect(result.current.intervalConfig.activeInterval).toBe('1');
    expect(result.current.points).toEqual(
      buildResponse(100, currentTimestamp - 60).points,
    );
    expect(result.current.viewportRequest).toBeNull();
    expect(mockEmitTradingViewNativeDebugEvent).toHaveBeenCalledWith({
      details: expect.objectContaining({
        pointTimestamp: realtimePoint.t,
        reason: 'history-not-ready',
      }),
      level: 'warning',
      name: 'realtime.point.ignored',
    });
  });

  it('advances the newer cursor when go-to-date crosses now after a historical jump', async () => {
    const crossNowHistoryRequest =
      createDeferred<ITradingViewNativeHistoryResponse | null>();
    jest.spyOn(Date, 'now').mockReturnValue(2_000_000_000);
    const currentTimestamp = 2_000_000;
    const historicalRange = {
      from: 500_000,
      to: 503_600,
    };
    const crossNowRange = {
      from: currentTimestamp - 3 * 24 * 3600,
      to: currentTimestamp + 4 * 24 * 3600,
    };
    const latestHistoryCandles = Array.from({ length: 50 }, (_, index) => ({
      close: 100 + index,
      timestamp: currentTimestamp - (51 - index) * 3600,
    }));
    const bufferedRealtimePoint = {
      o: 200,
      h: 202,
      l: 199,
      c: 201,
      v: 12,
      t: currentTimestamp - 3 * 3600,
    };
    const realtimePoint = {
      o: 201,
      h: 203,
      l: 200,
      c: 202,
      v: 14,
      t: currentTimestamp - 3600,
    };
    mockHistoryRequestCandleCount = 288;
    mockReadTradingViewNativeActiveInterval.mockReturnValue('1');
    mockFetchHistory.mockImplementation(
      async ({ interval, timeFrom, timeTo }) => {
        if (interval.value === '1') {
          return buildResponse(100, currentTimestamp - 60);
        }
        if (timeFrom === crossNowRange.from - 3600) {
          return crossNowHistoryRequest.promise;
        }
        return buildMultiPointResponse(
          [
            { close: 70, timestamp: historicalRange.from },
            { close: 80, timestamp: historicalRange.to },
            ...latestHistoryCandles,
          ].filter(
            ({ timestamp }) => timestamp >= timeFrom && timestamp <= timeTo,
          ),
        );
      },
    );
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({
        source: buildMarketSource({ realtime: 'websocket' }),
      }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(1));
    await waitFor(() => expect(mockSubscribeRealtime).toHaveBeenCalledTimes(1));
    act(() =>
      result.current.handleIntervalChange('60', {
        skipNextHistoryRequest: true,
      }),
    );
    await waitFor(() =>
      expect(result.current.intervalConfig.activeInterval).toBe('60'),
    );
    await waitFor(() => expect(mockSubscribeRealtime).toHaveBeenCalledTimes(2));
    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timeRange',
        ...historicalRange,
      });
    });
    act(() =>
      result.current.handleViewportRequestApplied(
        result.current.viewportRequest?.requestId ?? 0,
      ),
    );

    let navigationPromise = Promise.resolve();
    act(() => {
      navigationPromise = result.current.handleViewportTargetChange({
        kind: 'timeRange',
        ...crossNowRange,
      });
    });
    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(3));
    pushRealtimePoint(bufferedRealtimePoint);

    await act(async () => {
      crossNowHistoryRequest.resolve(
        buildMultiPointResponse(latestHistoryCandles),
      );
      await navigationPromise;
    });

    expect(mockFetchHistory).toHaveBeenCalledTimes(4);
    const latestHistoryTimestamp =
      latestHistoryCandles[latestHistoryCandles.length - 1]?.timestamp;
    expect(result.current.points[result.current.points.length - 1]?.t).toBe(
      latestHistoryTimestamp,
    );
    expect(result.current.viewportRequest).toEqual(
      expect.objectContaining({
        target: {
          kind: 'timeRange',
          from: crossNowRange.from,
          to: latestHistoryTimestamp,
        },
      }),
    );
    act(() =>
      result.current.handleViewportRequestApplied(
        result.current.viewportRequest?.requestId ?? 0,
      ),
    );
    act(() =>
      result.current.handleVisiblePointRangeChange({
        endIndex: result.current.points.length,
        startIndex: result.current.points.length - 10,
      }),
    );
    expect(mockFetchHistory).toHaveBeenCalledTimes(4);
    pushRealtimePoint(realtimePoint);
    expect(result.current.points[result.current.points.length - 1]).toEqual(
      realtimePoint,
    );
    expect(mockFetchHistory).toHaveBeenCalledTimes(4);
  });

  it('does not clamp a cross-now go-to-date target to an old historical window when both pages are empty', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(2_000_000_000);
    const currentTimestamp = 2_000_000;
    const historicalRange = {
      from: 500_000,
      to: 503_600,
    };
    const crossNowRange = {
      from: currentTimestamp - 3 * 24 * 3600,
      to: currentTimestamp + 4 * 24 * 3600,
    };
    mockHistoryRequestCandleCount = 2000;
    mockReadTradingViewNativeActiveInterval.mockReturnValue('1');
    let hourlyRequestCount = 0;
    mockFetchHistory.mockImplementation(async ({ interval }) => {
      if (interval.value === '1') {
        return buildResponse(100, currentTimestamp - 60);
      }
      hourlyRequestCount += 1;
      return hourlyRequestCount === 1
        ? buildMultiPointResponse([
            { close: 70, timestamp: historicalRange.from },
            { close: 80, timestamp: historicalRange.to },
          ])
        : { points: [], total: 0 };
    });
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(1));
    act(() =>
      result.current.handleIntervalChange('60', {
        skipNextHistoryRequest: true,
      }),
    );
    await waitFor(() =>
      expect(result.current.intervalConfig.activeInterval).toBe('60'),
    );
    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timeRange',
        ...historicalRange,
      });
    });
    act(() =>
      result.current.handleViewportRequestApplied(
        result.current.viewportRequest?.requestId ?? 0,
      ),
    );

    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timeRange',
        ...crossNowRange,
      });
    });

    expect(mockFetchHistory).toHaveBeenCalledTimes(4);
    expect(result.current.points.map((point) => point.t)).toEqual([
      historicalRange.from,
      historicalRange.to,
    ]);
    expect(result.current.viewportRequest).toBeNull();
    expect(
      mockFetchHistory.mock.calls.some(
        ([request]) => request.interval.value === '1W',
      ),
    ).toBe(false);
  });

  it('does not treat an old historical window as the latest when its future refresh is empty', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(2_000_000_000);
    const currentTimestamp = 2_000_000;
    const historicalRange = {
      from: 500_000,
      to: 503_600,
    };
    mockHistoryRequestCandleCount = 2000;
    mockReadTradingViewNativeActiveInterval.mockReturnValue('1');
    let fifteenMinuteRequestCount = 0;
    mockFetchHistory.mockImplementation(async ({ interval }) => {
      if (interval.value === '1') {
        return buildResponse(100, currentTimestamp - 60);
      }
      fifteenMinuteRequestCount += 1;
      return fifteenMinuteRequestCount === 1
        ? buildMultiPointResponse([
            { close: 70, timestamp: historicalRange.from },
            { close: 80, timestamp: historicalRange.to },
          ])
        : { points: [], total: 0 };
    });
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(1));
    act(() =>
      result.current.handleIntervalChange('15', {
        skipNextHistoryRequest: true,
      }),
    );
    await waitFor(() =>
      expect(result.current.intervalConfig.activeInterval).toBe('15'),
    );
    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timeRange',
        ...historicalRange,
      });
    });
    act(() =>
      result.current.handleViewportRequestApplied(
        result.current.viewportRequest?.requestId ?? 0,
      ),
    );

    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timeRange',
        from: currentTimestamp + 16 * 3600,
        to: currentTimestamp + 24 * 3600,
      });
    });

    expect(mockFetchHistory).toHaveBeenCalledTimes(3);
    expect(mockFetchHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({
        interval: expect.objectContaining({ value: '15' }),
        timeFrom: currentTimestamp - 2000 * 900,
        timeTo: currentTimestamp,
      }),
    );
    expect(result.current.points.map((point) => point.t)).toEqual([
      historicalRange.from,
      historicalRange.to,
    ]);
    expect(result.current.viewportRequest).toBeNull();
    expect(
      mockFetchHistory.mock.calls.some(
        ([request]) => request.interval.value === '1W',
      ),
    ).toBe(false);
  });

  it('rolls back an interval switch when its future latest page is empty without probing the earliest boundary', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(2_000_000_000);
    const currentTimestamp = 2_000_000;
    mockHistoryRequestCandleCount = 288;
    mockReadTradingViewNativeActiveInterval.mockReturnValue('1');
    mockFetchHistory.mockImplementation(async ({ interval }) =>
      interval.value === '1'
        ? buildResponse(100, currentTimestamp - 60)
        : { points: [], total: 0 },
    );
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(1));
    act(() =>
      result.current.handleIntervalChange('5', {
        skipNextHistoryRequest: true,
      }),
    );
    await waitFor(() =>
      expect(result.current.intervalConfig.activeInterval).toBe('5'),
    );
    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timeRange',
        from: currentTimestamp + 16 * 3600,
        to: currentTimestamp + 24 * 3600,
      });
    });

    await waitFor(() =>
      expect(result.current.intervalConfig.activeInterval).toBe('1'),
    );
    expect(mockFetchHistory).toHaveBeenCalledTimes(2);
    expect(mockFetchHistory.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        interval: expect.objectContaining({ value: '5' }),
        timeFrom: currentTimestamp - 24 * 3600,
        timeTo: currentTimestamp,
      }),
    );
    expect(
      mockFetchHistory.mock.calls.some(
        ([request]) => request.interval.value === '1W',
      ),
    ).toBe(false);
    expect(result.current.points.map((point) => point.t)).toEqual([
      currentTimestamp - 60,
    ]);
    expect(result.current.viewportRequest).toBeNull();
  });

  it('searches for the real earliest candle when the target page is empty', async () => {
    const targetTimestamp = 100_000;
    const earliestTimestamp = 500_000;
    const availableCandles = [
      { close: 70, timestamp: earliestTimestamp },
      { close: 80, timestamp: earliestTimestamp + 3600 },
      { close: 90, timestamp: earliestTimestamp + 7200 },
    ];
    mockHistoryBatchSize = 4;
    mockHistoryRequestCandleCount = 4;
    mockFetchHistory
      .mockResolvedValueOnce(
        buildMultiPointResponse([
          { close: 100, timestamp: 1_000_000 },
          { close: 110, timestamp: 1_003_600 },
        ]),
      )
      .mockImplementation(async ({ timeFrom, timeTo }) =>
        buildMultiPointResponse(
          availableCandles.filter(
            ({ timestamp }) => timestamp >= timeFrom && timestamp <= timeTo,
          ),
        ),
      );
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(2));
    act(() => result.current.handleHistoryBoundaryPrefetch());
    await waitFor(() =>
      expect(
        mockFetchHistory.mock.calls.filter(
          ([request]) => request.interval.value === '1W',
        ),
      ).toHaveLength(1),
    );
    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timestamp',
        timestamp: targetTimestamp,
      });
    });

    expect(mockFetchHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        interval: expect.objectContaining({ value: '1W' }),
        timeFrom: 0,
      }),
    );
    expect(
      mockFetchHistory.mock.calls.filter(
        ([request]) => request.interval.value === '1W',
      ),
    ).toHaveLength(1);
    expect(result.current.points.map((point) => point.t)).toEqual([
      earliestTimestamp,
      earliestTimestamp + 3600,
      earliestTimestamp + 7200,
      1_000_000,
      1_003_600,
    ]);
    expect(result.current.viewportRequest).toEqual(
      expect.objectContaining({
        target: {
          kind: 'timestamp',
          timestamp: earliestTimestamp,
        },
      }),
    );
  });

  it('finishes an interval switch at the prefetched boundary for a pre-listing range', async () => {
    const earliestTimestamp = 510_000;
    mockHistoryBatchSize = 2;
    jest.spyOn(Date, 'now').mockReturnValue(2_000_000_000);
    mockFetchHistory.mockImplementation(
      async ({ interval, timeFrom, timeTo }) => {
        if (interval.value === '60') {
          return buildResponse(100, 1_000_000);
        }
        if (interval.value === '1W') {
          return buildResponse(80, 500_000);
        }
        if (interval.value === '1D') {
          return buildResponse(90, earliestTimestamp);
        }
        return buildMultiPointResponse(
          [
            { close: 70, timestamp: earliestTimestamp },
            { close: 80, timestamp: earliestTimestamp + 900 },
          ].filter(
            ({ timestamp }) => timestamp >= timeFrom && timestamp <= timeTo,
          ),
        );
      },
    );
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(1));
    act(() => result.current.handleHistoryBoundaryPrefetch());
    await waitFor(() =>
      expect(result.current.calendarAvailableTimeRange).toEqual({
        from: earliestTimestamp,
      }),
    );
    act(() =>
      result.current.handleIntervalChange('15', {
        skipNextHistoryRequest: true,
      }),
    );
    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timeRange',
        from: 100_000,
        to: 101_000,
      });
    });

    expect(result.current.isSwitchingInterval).toBe(false);
    expect(result.current.points.map((point) => point.t)).toEqual([
      earliestTimestamp,
      earliestTimestamp + 900,
    ]);
    expect(result.current.viewportRequest).toEqual(
      expect.objectContaining({
        target: {
          kind: 'timestamp',
          timestamp: earliestTimestamp,
        },
      }),
    );
  });

  it('uses a prefetched boundary before the initial chart history is ready', async () => {
    const initialHistoryRequest =
      createDeferred<ITradingViewNativeHistoryResponse | null>();
    const earliestTimestamp = 510_000;
    mockHistoryBatchSize = 2;
    jest.spyOn(Date, 'now').mockReturnValue(2_000_000_000);
    mockFetchHistory.mockImplementation(
      async ({ interval, timeFrom, timeTo }) => {
        if (interval.value === '60') {
          return initialHistoryRequest.promise;
        }
        if (interval.value === '1W') {
          return buildResponse(80, 500_000);
        }
        if (interval.value === '1D') {
          return buildResponse(90, earliestTimestamp);
        }
        return buildMultiPointResponse(
          [
            { close: 70, timestamp: earliestTimestamp },
            { close: 80, timestamp: earliestTimestamp + 900 },
          ].filter(
            ({ timestamp }) => timestamp >= timeFrom && timestamp <= timeTo,
          ),
        );
      },
    );
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    act(() => result.current.handleHistoryBoundaryPrefetch());
    await waitFor(() =>
      expect(result.current.calendarAvailableTimeRange).toEqual({
        from: earliestTimestamp,
      }),
    );
    expect(result.current.points).toEqual([]);

    act(() =>
      result.current.handleIntervalChange('15', {
        skipNextHistoryRequest: true,
      }),
    );
    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timeRange',
        from: 100_000,
        to: 101_000,
      });
    });

    expect(result.current.points.map((point) => point.t)).toEqual([
      earliestTimestamp,
      earliestTimestamp + 900,
    ]);
    expect(result.current.viewportRequest).toEqual(
      expect.objectContaining({
        target: {
          kind: 'timestamp',
          timestamp: earliestTimestamp,
        },
      }),
    );
  });

  it('keeps the target inside the native Market 200-point history page', async () => {
    const targetTimestamp = 10_000_000;
    mockHistoryBatchSize = 200;
    mockHistoryRequestCandleCount = 2000;
    mockFetchHistory
      .mockResolvedValueOnce(
        buildMultiPointResponse([
          {
            close: 100,
            timestamp: targetTimestamp + 14 * 24 * 3600,
          },
          {
            close: 110,
            timestamp: targetTimestamp + 24 * 24 * 3600,
          },
        ]),
      )
      .mockImplementationOnce(async ({ timeTo }) =>
        buildSequentialResponse({
          count: 200,
          firstTimestamp: timeTo - 199 * 3600,
        }),
      );
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(2));
    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timestamp',
        timestamp: targetTimestamp,
      });
    });

    expect(mockFetchHistory).toHaveBeenCalledTimes(2);
    expect(mockFetchHistory.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        timeFrom: targetTimestamp - 1802 * 3600,
        timeTo: targetTimestamp + 198 * 3600,
      }),
    );
    expect(result.current.points.map((point) => point.t)).toContain(
      targetTimestamp,
    );
    expect(result.current.viewportRequest).toEqual(
      expect.objectContaining({
        target: {
          kind: 'timestamp',
          timestamp: targetTimestamp,
        },
      }),
    );
  });

  it('loads older target pages before exposing the viewport request', async () => {
    const targetTimestamp = 10_000_000;
    const olderTargetPage =
      createDeferred<ITradingViewNativeHistoryResponse | null>();
    mockHistoryBatchSize = 2;
    mockHistoryRequestCandleCount = 2000;
    mockFetchHistory
      .mockResolvedValueOnce(
        buildMultiPointResponse([
          { close: 100, timestamp: targetTimestamp + 100_000 },
          { close: 110, timestamp: targetTimestamp + 103_600 },
        ]),
      )
      .mockResolvedValueOnce(
        buildMultiPointResponse([
          { close: 80, timestamp: targetTimestamp + 10_000 },
          { close: 90, timestamp: targetTimestamp + 13_600 },
        ]),
      )
      .mockReturnValueOnce(olderTargetPage.promise);
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(2));
    let navigationPromise = Promise.resolve();
    act(() => {
      navigationPromise = result.current.handleViewportTargetChange({
        kind: 'timestamp',
        timestamp: targetTimestamp,
      });
    });
    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(3));

    expect(mockFetchHistory.mock.calls[2]?.[0]).toEqual(
      expect.objectContaining({
        timeTo: targetTimestamp + 9999,
      }),
    );
    expect(result.current.points).toHaveLength(2);
    expect(result.current.viewportRequest).toBeNull();

    await act(async () => {
      olderTargetPage.resolve(buildResponse(70, targetTimestamp));
      await navigationPromise;
    });

    expect(result.current.points.map((point) => point.t)).toContain(
      targetTimestamp,
    );
    expect(result.current.viewportRequest).toEqual(
      expect.objectContaining({
        target: {
          kind: 'timestamp',
          timestamp: targetTimestamp,
        },
      }),
    );
  });

  it('extends a short target page before exposing the viewport', async () => {
    const targetTimestamp = 100_000;
    const forwardRequest =
      createDeferred<ITradingViewNativeHistoryResponse | null>();
    mockHistoryBatchSize = 300;
    mockHistoryRequestCandleCount = 400;
    mockFetchHistory
      .mockResolvedValueOnce(
        buildMultiPointResponse([
          { close: 100, timestamp: 1_000_000 },
          { close: 110, timestamp: 1_003_600 },
        ]),
      )
      .mockResolvedValueOnce(
        buildSequentialResponse({
          count: 3,
          firstTimestamp: targetTimestamp + 10 * 3600,
          startingClose: 70,
        }),
      )
      .mockReturnValueOnce(forwardRequest.promise);
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(2));
    let navigationPromise = Promise.resolve();
    act(() => {
      navigationPromise = result.current.handleViewportTargetChange({
        kind: 'timestamp',
        timestamp: targetTimestamp,
      });
    });
    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(3));

    expect(mockFetchHistory.mock.calls[2]?.[0]).toEqual(
      expect.objectContaining({
        timeFrom: targetTimestamp + 12 * 3600 + 1,
        timeTo: targetTimestamp + 208 * 3600,
      }),
    );
    expect(result.current.points).toHaveLength(2);
    expect(result.current.viewportRequest).toBeNull();

    await act(async () => {
      forwardRequest.resolve(
        buildSequentialResponse({
          count: 196,
          firstTimestamp: targetTimestamp + 13 * 3600,
          startingClose: 73,
        }),
      );
      await navigationPromise;
    });

    expect(result.current.points).toHaveLength(201);
    expect(result.current.viewportRequest).toEqual(
      expect.objectContaining({
        target: {
          kind: 'timestamp',
          timestamp: targetTimestamp + 10 * 3600,
        },
      }),
    );
  });

  it('keeps the requested target anchored while filling the visible history gap', async () => {
    const targetTimestamp = 100_000;
    mockHistoryBatchSize = 3;
    mockHistoryRequestCandleCount = 2;
    mockFetchHistory
      .mockResolvedValueOnce(
        buildSequentialResponse({
          count: 10,
          firstTimestamp: 1_000_000,
          startingClose: 100,
        }),
      )
      .mockResolvedValueOnce(
        buildMultiPointResponse([
          { close: 70, timestamp: targetTimestamp },
          { close: 80, timestamp: targetTimestamp + 3600 },
        ]),
      )
      .mockResolvedValueOnce(
        buildSequentialResponse({
          count: 100,
          firstTimestamp: targetTimestamp + 2 * 3600,
          startingClose: 81,
        }),
      )
      .mockResolvedValueOnce(
        buildSequentialResponse({
          count: 100,
          firstTimestamp: targetTimestamp + 102 * 3600,
          startingClose: 181,
        }),
      );
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(10));
    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timestamp',
        timestamp: targetTimestamp,
      });
    });
    const navigationRequestId = result.current.viewportRequest?.requestId;
    expect(result.current.points).toHaveLength(12);
    act(() =>
      result.current.handleViewportRequestApplied(navigationRequestId ?? 0),
    );

    act(() =>
      result.current.handleVisiblePointRangeChange({
        endIndex: 2,
        startIndex: 0,
      }),
    );

    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(3));
    expect(mockFetchHistory.mock.calls[2]?.[0]).toEqual(
      expect.objectContaining({
        timeFrom: targetTimestamp + 3601,
        timeTo: targetTimestamp + 101 * 3600,
      }),
    );
    await waitFor(() => expect(result.current.points).toHaveLength(112));
    expect(result.current.points.map((point) => point.t)).toContain(
      targetTimestamp + 101 * 3600,
    );
    expect(result.current.viewportRequest).toEqual(
      expect.objectContaining({
        preserveVisibleAnchor: true,
        requestId: (navigationRequestId ?? 0) + 1,
        target: {
          kind: 'timestamp',
          timestamp: targetTimestamp,
        },
      }),
    );
    act(() =>
      result.current.handleViewportRequestApplied(
        result.current.viewportRequest?.requestId ?? 0,
      ),
    );

    act(() =>
      result.current.handleVisiblePointRangeChange({
        endIndex: 82,
        startIndex: 0,
      }),
    );
    expect(mockFetchHistory).toHaveBeenCalledTimes(3);

    act(() =>
      result.current.handleVisiblePointRangeChange({
        endIndex: 83,
        startIndex: 0,
      }),
    );
    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(4));
    expect(mockFetchHistory.mock.calls[3]?.[0]).toEqual(
      expect.objectContaining({
        timeFrom: targetTimestamp + 101 * 3600 + 1,
        timeTo: targetTimestamp + 201 * 3600,
      }),
    );
    await waitFor(() => expect(result.current.points).toHaveLength(212));

    act(() =>
      result.current.handleVisiblePointRangeChange({
        endIndex: 203,
        startIndex: 101,
      }),
    );
    expect(mockFetchHistory).toHaveBeenCalledTimes(4);
  });

  it('continues scanning after an empty visible-gap window', async () => {
    const targetTimestamp = 100_000;
    mockHistoryBatchSize = 3;
    mockHistoryRequestCandleCount = 2;
    mockFetchHistory
      .mockResolvedValueOnce(
        buildSequentialResponse({
          count: 10,
          firstTimestamp: 1_000_000,
          startingClose: 100,
        }),
      )
      .mockResolvedValueOnce(
        buildMultiPointResponse([
          { close: 70, timestamp: targetTimestamp },
          { close: 80, timestamp: targetTimestamp + 3600 },
        ]),
      )
      .mockResolvedValueOnce({ points: [], total: 0 })
      .mockResolvedValueOnce(
        buildSequentialResponse({
          count: 100,
          firstTimestamp: targetTimestamp + 102 * 3600,
          startingClose: 81,
        }),
      );
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(10));
    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timestamp',
        timestamp: targetTimestamp,
      });
    });
    act(() =>
      result.current.handleViewportRequestApplied(
        result.current.viewportRequest?.requestId ?? 0,
      ),
    );
    act(() =>
      result.current.handleVisiblePointRangeChange({
        endIndex: 2,
        startIndex: 0,
      }),
    );

    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(4));
    expect(mockFetchHistory.mock.calls[2]?.[0]).toEqual(
      expect.objectContaining({
        timeFrom: targetTimestamp + 3601,
        timeTo: targetTimestamp + 101 * 3600,
      }),
    );
    expect(mockFetchHistory.mock.calls[3]?.[0]).toEqual(
      expect.objectContaining({
        timeFrom: targetTimestamp + 101 * 3600 + 1,
        timeTo: targetTimestamp + 201 * 3600,
      }),
    );
    await waitFor(() => expect(result.current.points).toHaveLength(112));
  });

  it('navigates within loaded history without another request', async () => {
    mockFetchHistory.mockResolvedValue(
      buildMultiPointResponse([
        { close: 100, timestamp: 100 },
        { close: 110, timestamp: 200 },
      ]),
    );
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(2));
    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timeRange',
        from: 120,
        to: 180,
      });
    });

    expect(mockFetchHistory).toHaveBeenCalledTimes(1);
    expect(result.current.viewportRequest).toEqual(
      expect.objectContaining({
        requestId: 1,
        target: {
          kind: 'timeRange',
          from: 120,
          to: 180,
        },
      }),
    );

    act(() =>
      result.current.handleViewportRequestApplied(
        result.current.viewportRequest?.requestId ?? 0,
      ),
    );
    expect(result.current.viewportRequest).toBeNull();
  });

  it('loads both ends of a large time range without walking every middle page', async () => {
    const rangeFrom = 10_000_000;
    const rangeTo = 100_000_000;
    mockHistoryBatchSize = 200;
    mockHistoryRequestCandleCount = 2000;
    mockFetchHistory
      .mockResolvedValueOnce(
        buildSequentialResponse({
          count: 2,
          firstTimestamp: 200_000_000,
          startingClose: 100,
        }),
      )
      .mockResolvedValueOnce(
        buildSequentialResponse({
          count: 200,
          firstTimestamp: rangeTo - 199 * 3600,
          startingClose: 200,
        }),
      )
      .mockResolvedValueOnce(
        buildSequentialResponse({
          count: 199,
          firstTimestamp: rangeFrom,
          startingClose: 400,
        }),
      );
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(2));
    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timeRange',
        from: rangeFrom,
        to: rangeTo,
      });
    });

    expect(mockFetchHistory).toHaveBeenCalledTimes(3);
    expect(mockFetchHistory.mock.calls[2]?.[0]).toEqual(
      expect.objectContaining({
        timeFrom: rangeFrom - 1802 * 3600,
        timeTo: rangeFrom + 198 * 3600,
      }),
    );
    expect(result.current.viewportRequest).toEqual(
      expect.objectContaining({
        target: {
          kind: 'timeRange',
          from: rangeFrom,
          to: rangeTo,
        },
      }),
    );
  });

  it('fetches a target that falls inside a gap between loaded pages', async () => {
    mockFetchHistory
      .mockResolvedValueOnce(
        buildMultiPointResponse([
          { close: 80, timestamp: 100 },
          { close: 110, timestamp: 1_000_000 },
        ]),
      )
      .mockResolvedValueOnce(buildResponse(90, 500_000))
      .mockResolvedValueOnce(null);
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(2));
    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timestamp',
        timestamp: 500_000,
      });
    });

    expect(mockFetchHistory).toHaveBeenCalledTimes(3);
    expect(mockFetchHistory.mock.calls[2]?.[0]).toEqual(
      expect.objectContaining({
        timeFrom: 500_001,
        timeTo: 503_600,
      }),
    );
    expect(result.current.points.map((point) => point.t)).toContain(500_000);
  });

  it('does not navigate or probe boundaries after a null target response', async () => {
    jest.useFakeTimers();
    mockFetchHistory
      .mockResolvedValueOnce(
        buildMultiPointResponse([
          { close: 80, timestamp: 100 },
          { close: 110, timestamp: 1_000_000 },
        ]),
      )
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await act(async () => Promise.resolve());
    let navigationPromise = Promise.resolve();
    act(() => {
      navigationPromise = result.current.handleViewportTargetChange({
        kind: 'timestamp',
        timestamp: 500_000,
      });
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(4001);
      await navigationPromise;
    });

    expect(mockFetchHistory).toHaveBeenCalledTimes(4);
    expect(result.current.points.map((point) => point.t)).toEqual([
      100, 1_000_000,
    ]);
    expect(result.current.viewportRequest).toBeNull();
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

    mockSaveTradingViewNativeActiveInterval.mockClear();
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
    expect(mockSaveTradingViewNativeActiveInterval).not.toHaveBeenCalledWith(
      expect.objectContaining({ interval: '1' }),
    );
  });

  it('aborts selected-interval history when time navigation takes over', async () => {
    const intervalRequest = createDeferred<IMarketTokenKLineResponse | null>();
    mockFetchHistory
      .mockResolvedValueOnce(buildResponse(100, 1_000_000))
      .mockReturnValueOnce(intervalRequest.promise)
      .mockResolvedValueOnce(buildResponse(80, 500_000));
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points[0]?.c).toBe(100));
    act(() => result.current.handleIntervalChange('1'));
    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(2));
    const intervalHistorySignal = mockFetchHistory.mock.calls[1]?.[0].signal;
    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timestamp',
        timestamp: 500_000,
      });
    });

    expect(result.current.candleIntervalSeconds).toBe(60);
    expect(result.current.points.map((point) => point.t)).toEqual([500_000]);
    expect(result.current.viewportRequest).toEqual(
      expect.objectContaining({
        target: { kind: 'timestamp', timestamp: 500_000 },
      }),
    );
    expect(intervalHistorySignal?.aborted).toBe(true);

    await act(async () => {
      intervalRequest.resolve(buildResponse(110, 1_000_000));
      await intervalRequest.promise;
    });
    expect(result.current.points.map((point) => point.t)).toEqual([500_000]);
  });

  it('loads newer pages without moving a historical viewport to the right edge', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000_000_000);
    mockHistoryBatchSize = 200;
    mockHistoryRequestCandleCount = 2000;
    mockFetchHistory
      .mockResolvedValueOnce(buildResponse(100, 990_000))
      .mockResolvedValueOnce(
        buildMultiPointResponse(
          Array.from({ length: 100 }, (_, index) => ({
            close: 70 + index,
            timestamp: 100_000 + index * 900,
          })),
        ),
      )
      .mockResolvedValueOnce(
        buildMultiPointResponse(
          Array.from({ length: 100 }, (_, index) => ({
            close: 170 + index,
            timestamp: 190_000 + index * 900,
          })),
        ),
      )
      .mockResolvedValueOnce(
        buildMultiPointResponse(
          Array.from({ length: 100 }, (_, index) => ({
            close: 270 + index,
            timestamp: 280_000 + index * 900,
          })),
        ),
      );
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(1));
    act(() =>
      result.current.handleIntervalChange('15', {
        skipNextHistoryRequest: true,
      }),
    );
    await waitFor(() =>
      expect(result.current.intervalConfig.activeInterval).toBe('15'),
    );
    expect(mockFetchHistory).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timeRange',
        from: 100_000,
        to: 189_100,
      });
    });
    const viewportRequestId = result.current.viewportRequest?.requestId;
    act(() =>
      result.current.handleViewportRequestApplied(viewportRequestId ?? 0),
    );
    act(() =>
      result.current.handleVisiblePointRangeChange({
        endIndex: 100,
        startIndex: 80,
      }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(200));
    expect(mockFetchHistory.mock.calls[2]?.[0]).toEqual(
      expect.objectContaining({
        interval: expect.objectContaining({ value: '15' }),
        timeFrom: 189_101,
        timeTo: 279_100,
      }),
    );
    expect(result.current.viewportRequest).toEqual(
      expect.objectContaining({
        preserveVisibleAnchor: true,
        target: {
          kind: 'timestamp',
          timestamp: 180_100,
        },
      }),
    );
    act(() =>
      result.current.handleVisiblePointRangeChange({
        endIndex: 200,
        startIndex: 0,
      }),
    );
    expect(mockFetchHistory).toHaveBeenCalledTimes(3);
    act(() =>
      result.current.handleViewportRequestApplied(
        result.current.viewportRequest?.requestId ?? 0,
      ),
    );
    act(() =>
      result.current.handleVisiblePointRangeChange({
        endIndex: 100,
        startIndex: 80,
      }),
    );
    expect(mockFetchHistory).toHaveBeenCalledTimes(3);

    act(() =>
      result.current.handleVisiblePointRangeChange({
        endIndex: 200,
        startIndex: 180,
      }),
    );
    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(4));
  });

  it('finds the next newer candle after an empty forward window', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(300_000_000);
    mockHistoryBatchSize = 200;
    mockHistoryRequestCandleCount = 2000;
    mockFetchHistory
      .mockResolvedValueOnce(buildResponse(100, 290_000))
      .mockResolvedValueOnce(
        buildMultiPointResponse([
          { close: 70, timestamp: 100_000 },
          { close: 80, timestamp: 100_900 },
        ]),
      )
      .mockResolvedValueOnce({ points: [], total: 0 })
      .mockResolvedValueOnce(buildResponse(90, 192_000))
      .mockResolvedValueOnce({ points: [], total: 0 });
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(1));
    act(() =>
      result.current.handleIntervalChange('15', {
        skipNextHistoryRequest: true,
      }),
    );
    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timeRange',
        from: 100_000,
        to: 100_900,
      });
    });
    act(() =>
      result.current.handleViewportRequestApplied(
        result.current.viewportRequest?.requestId ?? 0,
      ),
    );
    act(() =>
      result.current.handleVisiblePointRangeChange({
        endIndex: 2,
        startIndex: 0,
      }),
    );

    await waitFor(() =>
      expect(result.current.points.map((point) => point.t)).toContain(192_000),
    );
    expect(mockFetchHistory.mock.calls[2]?.[0]).toEqual(
      expect.objectContaining({
        timeFrom: 100_901,
        timeTo: 190_900,
      }),
    );
    expect(mockFetchHistory.mock.calls[3]?.[0]).toEqual(
      expect.objectContaining({
        timeFrom: 190_901,
        timeTo: 300_000,
      }),
    );
  });

  it('does not let a bounded time-range response disable older pagination', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(108_100_000);
    mockHistoryBatchSize = 200;
    mockHistoryRequestCandleCount = 2000;
    const targetPoints = Array.from({ length: 10 }, (_, index) => ({
      close: 70 + index,
      timestamp: 100_000 + index * 900,
    }));
    mockFetchHistory
      .mockResolvedValueOnce(buildResponse(100, 108_100))
      .mockResolvedValueOnce(buildMultiPointResponse(targetPoints))
      .mockResolvedValueOnce(buildResponse(60, 99_100));
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(1));
    act(() =>
      result.current.handleIntervalChange('15', {
        skipNextHistoryRequest: true,
      }),
    );
    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timeRange',
        from: 100_000,
        to: 108_100,
      });
    });
    act(() =>
      result.current.handleViewportRequestApplied(
        result.current.viewportRequest?.requestId ?? 0,
      ),
    );
    act(() =>
      result.current.handleVisiblePointRangeChange({
        endIndex: 10,
        startIndex: 0,
      }),
    );

    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(3));
    expect(mockFetchHistory.mock.calls[2]?.[0]).toEqual(
      expect.objectContaining({
        timeTo: 99_999,
      }),
    );
    await waitFor(() => expect(result.current.points[0]?.t).toBe(99_100));
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

  it('applies Market metadata without restarting in-flight address history', async () => {
    const historyRequest = createDeferred<IMarketTokenKLineResponse | null>();
    mockFetchHistory.mockReturnValue(historyRequest.promise);
    const { result, rerender } = renderHook(
      ({
        realtime,
        symbol,
      }: {
        realtime: 'disabled' | 'websocket';
        symbol: string;
      }) =>
        useTradingViewNativeKLine({
          source: buildMarketSource({ realtime, symbol }),
        }),
      {
        initialProps: {
          realtime: 'disabled' as 'disabled' | 'websocket',
          symbol: '',
        },
      },
    );

    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(1));
    const initialHistorySignal = mockFetchHistory.mock.calls[0]?.[0].signal;
    expect(mockSubscribeRealtime).not.toHaveBeenCalled();
    expect(result.current.dataProviderKey).toBe('market:evm--1:0x123');

    rerender({ realtime: 'websocket', symbol: 'MSTRon' });
    await waitFor(() => expect(mockSubscribeRealtime).toHaveBeenCalledTimes(1));
    expect(mockFetchHistory).toHaveBeenCalledTimes(1);
    expect(initialHistorySignal?.aborted).toBe(false);
    expect(result.current.dataProviderKey).toBe('market:evm--1:0x123');

    await act(async () => {
      historyRequest.resolve(buildResponse(100));
      await historyRequest.promise;
    });
    await waitFor(() => expect(result.current.points[0]?.c).toBe(100));
    expect(mockFetchHistory).toHaveBeenCalledTimes(1);
  });

  it('keeps realtime subscribed when time navigation aborts initial history', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(500_000_000);
    const initialHistoryRequest =
      createDeferred<ITradingViewNativeHistoryResponse | null>();
    mockFetchHistory
      .mockReturnValueOnce(initialHistoryRequest.promise)
      .mockResolvedValueOnce(buildResponse(90, 499_000));
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({
        source: buildMarketSource({ realtime: 'websocket' }),
      }),
    );

    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockSubscribeRealtime).toHaveBeenCalledTimes(1));
    const initialHistorySignal = mockFetchHistory.mock.calls[0]?.[0].signal;
    const realtimeSignal = mockSubscribeRealtime.mock.calls[0]?.[0].signal;

    await act(async () => {
      await result.current.handleViewportTargetChange({
        kind: 'timeRange',
        from: 499_000,
        to: 499_000,
      });
    });

    expect(initialHistorySignal?.aborted).toBe(true);
    expect(realtimeSignal?.aborted).toBe(false);
    pushRealtimePoint({
      o: 90,
      h: 101,
      l: 89,
      c: 100,
      v: 12,
      t: 500_000,
    });
    expect(result.current.points.map((point) => point.t)).toEqual([
      499_000, 500_000,
    ]);
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

  it('discards realtime candles until initial history is ready', async () => {
    const historyRequest = createDeferred<IMarketTokenKLineResponse | null>();
    mockFetchHistory.mockReturnValue(historyRequest.promise);
    const handleRealtimePoint = jest.fn();
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({
        onRealtimePoint: handleRealtimePoint,
        source: buildMarketSource({ realtime: 'websocket' }),
      }),
    );

    await waitFor(() => expect(mockSubscribeRealtime).toHaveBeenCalled());
    pushRealtimePoint({ o: 100, h: 106, l: 99, c: 105, v: 12, t: 100 });
    expect(result.current.points).toEqual([]);
    expect(handleRealtimePoint).not.toHaveBeenCalled();
    expect(mockEmitTradingViewNativeDebugEvent).toHaveBeenCalledWith({
      details: expect.objectContaining({
        reason: 'history-not-ready',
      }),
      level: 'warning',
      name: 'realtime.point.ignored',
    });
    await act(async () => {
      historyRequest.resolve(buildResponse(100));
      await historyRequest.promise;
    });

    await waitFor(() => expect(result.current.points[0]?.c).toBe(100));
    pushRealtimePoint({ o: 100, h: 106, l: 99, c: 105, v: 12, t: 100 });
    expect(result.current.points[0]?.c).toBe(105);
    expect(handleRealtimePoint).toHaveBeenCalledTimes(1);
  });

  it('preloads older history from a half-screen buffer to a full screen', async () => {
    mockHistoryBatchSize = 150;
    mockHistoryRequestCandleCount = 45;
    const olderHistoryRequest =
      createDeferred<IMarketTokenKLineResponse | null>();
    mockFetchHistory
      .mockResolvedValueOnce(
        buildSequentialResponse({
          count: 150,
          firstTimestamp: 1_000_000,
          startingClose: 100,
        }),
      )
      .mockReturnValueOnce(olderHistoryRequest.promise)
      .mockResolvedValueOnce(
        buildMultiPointResponse([
          { close: 249, timestamp: 1_536_400 },
          { close: 250, timestamp: 1_540_000 },
        ]),
      );
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(150));
    act(() =>
      result.current.handleVisiblePointRangeChange({
        endIndex: 136,
        startIndex: 46,
      }),
    );
    expect(mockFetchHistory).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.handleVisiblePointRangeChange({
        endIndex: 135,
        startIndex: 45,
      });
      result.current.handleVisiblePointRangeChange({
        endIndex: 90,
        startIndex: 0,
      });
    });
    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(2));
    expect(mockFetchHistory.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        interval: expect.objectContaining({ value: '60' }),
        timeFrom: 837_999,
        timeTo: 999_999,
      }),
    );

    await act(async () => {
      olderHistoryRequest.resolve(
        buildSequentialResponse({
          count: 45,
          firstTimestamp: 838_000,
          startingClose: 55,
        }),
      );
      await olderHistoryRequest.promise;
    });
    await waitFor(() => expect(result.current.points).toHaveLength(195));
    expect(result.current.points.slice(0, 3).map((point) => point.c)).toEqual([
      55, 56, 57,
    ]);

    updateVisibility(false);
    updateVisibility(true);
    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(result.current.points).toHaveLength(196));
    expect(result.current.points.at(-1)?.c).toBe(250);
  });

  it('retries a transient older-history failure automatically', async () => {
    jest.useFakeTimers();
    mockFetchHistory
      .mockResolvedValueOnce(buildResponse(110, 1_003_600))
      .mockRejectedValueOnce(new Error('temporary older-history failure'))
      .mockResolvedValueOnce(buildResponse(90, 996_400));
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(1));
    act(() => result.current.handleVisiblePointRangeChange({ startIndex: 0 }));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1001);
    });

    expect(mockFetchHistory).toHaveBeenCalledTimes(3);
    expect(result.current.points.map((point) => point.t)).toEqual([
      996_400, 1_003_600,
    ]);
  });

  it('keeps an OHLC chart when a single-value older page is empty', async () => {
    mockHistoryBatchSize = 2;
    mockHistoryRequestCandleCount = 2;
    mockFetchHistory
      .mockResolvedValueOnce(
        buildMultiPointResponse([
          { close: 100, timestamp: 1_000_000 },
          { close: 110, timestamp: 1_003_600 },
        ]),
      )
      .mockResolvedValueOnce({
        pointType: 'single',
        points: [],
        total: 0,
      });
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(2));
    expect(result.current.chartType).toBe('candlestick');
    act(() => result.current.handleVisiblePointRangeChange({ startIndex: 0 }));
    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(2));
    expect(result.current.chartType).toBe('candlestick');

    act(() => result.current.handleVisiblePointRangeChange({ startIndex: 0 }));
    expect(mockFetchHistory).toHaveBeenCalledTimes(2);
  });

  it('does not prepend CoinGecko fallback history to Market history', async () => {
    mockHistoryBatchSize = 2;
    mockHistoryRequestCandleCount = 2;
    mockFetchHistory
      .mockResolvedValueOnce(
        buildMultiPointResponse([
          { close: 100, timestamp: 1_000_000 },
          { close: 110, timestamp: 1_003_600 },
        ]),
      )
      .mockResolvedValueOnce({
        ...buildMultiPointResponse([
          { close: 80, timestamp: 992_800 },
          { close: 90, timestamp: 996_400 },
        ]),
        historySource: 'fallback',
        pointType: 'single',
      });
    const { result } = renderHook(() =>
      useTradingViewNativeKLine({ source: buildMarketSource() }),
    );

    await waitFor(() => expect(result.current.points).toHaveLength(2));
    expect(result.current.chartType).toBe('candlestick');
    act(() => result.current.handleVisiblePointRangeChange({ startIndex: 0 }));
    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(2));
    expect(result.current.points).toHaveLength(2);
    expect(result.current.points.map((point) => point.c)).toEqual([100, 110]);
    expect(result.current.chartType).toBe('candlestick');
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
      )
      .mockResolvedValueOnce(buildResponse(399, 7_847_200));
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
    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(4));
    expect(mockFetchHistory.mock.calls[3]?.[0]).toEqual(
      expect.objectContaining({
        timeFrom: 650_799,
        timeTo: 7_850_799,
      }),
    );
    await waitFor(() => expect(result.current.points).toHaveLength(897));
  });

  it('continues native Market pagination after a sparse 199-point page', async () => {
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
      )
      .mockResolvedValueOnce(buildResponse(799, 9_280_000));
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
    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(result.current.points).toHaveLength(400));
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

  it('ignores single-value metadata from an aborted older page', async () => {
    mockHistoryBatchSize = 2;
    mockHistoryRequestCandleCount = 2;
    const olderHistoryRequest =
      createDeferred<ITradingViewNativeHistoryResponse | null>();
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
          { close: 200, timestamp: 2_000_000 },
          { close: 210, timestamp: 2_003_600 },
        ]),
      )
      .mockResolvedValueOnce(
        buildMultiPointResponse([
          { close: 120, timestamp: 1_100_000 },
          { close: 130, timestamp: 1_103_600 },
        ]),
      );
    const { result, rerender } = renderHook(
      ({ tokenAddress }: { tokenAddress: string }) =>
        useTradingViewNativeKLine({
          source: buildMarketSource({ tokenAddress }),
        }),
      { initialProps: { tokenAddress: '0x123' } },
    );

    await waitFor(() =>
      expect(result.current.points.map((point) => point.c)).toEqual([100, 110]),
    );
    expect(result.current.chartType).toBe('candlestick');
    act(() => result.current.handleVisiblePointRangeChange({ startIndex: 0 }));
    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(2));
    const obsoleteRequest = mockFetchHistory.mock.calls[1]?.[0];

    rerender({ tokenAddress: '0x456' });
    await waitFor(() =>
      expect(result.current.points.map((point) => point.c)).toEqual([200, 210]),
    );
    expect(obsoleteRequest?.signal.aborted).toBe(true);

    await act(async () => {
      olderHistoryRequest.resolve({
        ...buildMultiPointResponse([
          { close: 80, timestamp: 992_800 },
          { close: 90, timestamp: 996_400 },
        ]),
        pointType: 'single',
      });
      await olderHistoryRequest.promise;
    });

    rerender({ tokenAddress: '0x123' });
    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(4));
    await waitFor(() =>
      expect(result.current.points.map((point) => point.c)).toEqual([120, 130]),
    );
    expect(result.current.chartType).toBe('candlestick');
  });

  it('resets history source selection when a series lifecycle restarts', async () => {
    mockFetchHistory
      .mockResolvedValueOnce(
        buildFallbackMultiPointResponse([{ close: 100, timestamp: 1_000_000 }]),
      )
      .mockResolvedValueOnce(buildResponse(200, 2_000_000))
      .mockResolvedValueOnce(buildResponse(120, 1_100_000));
    const { result, rerender } = renderHook(
      ({ tokenAddress }: { tokenAddress: string }) =>
        useTradingViewNativeKLine({
          source: buildMarketSource({ tokenAddress }),
        }),
      { initialProps: { tokenAddress: '0x123' } },
    );

    await waitFor(() => expect(result.current.points[0]?.c).toBe(100));

    rerender({ tokenAddress: '0x456' });
    await waitFor(() => expect(result.current.points[0]?.c).toBe(200));

    rerender({ tokenAddress: '0x123' });
    await waitFor(() => expect(result.current.points[0]?.c).toBe(120));
    expect(mockFetchHistory).toHaveBeenCalledTimes(3);
  });

  it('resets chart type classification when a series lifecycle restarts', async () => {
    mockHistoryBatchSize = 2;
    mockHistoryRequestCandleCount = 2;
    mockFetchHistory
      .mockResolvedValueOnce(
        buildMultiPointResponse([
          { close: 100, timestamp: 1_000_000 },
          { close: 110, timestamp: 1_003_600 },
        ]),
      )
      .mockResolvedValueOnce(
        buildMultiPointResponse([
          { close: 200, timestamp: 2_000_000 },
          { close: 210, timestamp: 2_003_600 },
        ]),
      )
      .mockResolvedValueOnce({
        ...buildFallbackMultiPointResponse([
          { close: 120, timestamp: 1_100_000 },
          { close: 130, timestamp: 1_103_600 },
        ]),
        pointType: 'single',
      });
    const { result, rerender } = renderHook(
      ({ tokenAddress }: { tokenAddress: string }) =>
        useTradingViewNativeKLine({
          source: buildMarketSource({ tokenAddress }),
        }),
      { initialProps: { tokenAddress: '0x123' } },
    );

    await waitFor(() => expect(result.current.points).toHaveLength(2));
    expect(result.current.points[0]?.c).toBe(100);
    expect(result.current.chartType).toBe('candlestick');

    rerender({ tokenAddress: '0x456' });
    await waitFor(() => expect(result.current.points[0]?.c).toBe(200));

    rerender({ tokenAddress: '0x123' });
    await waitFor(() => expect(result.current.points[0]?.c).toBe(120));
    expect(result.current.chartType).toBe('line');
    expect(mockFetchHistory).toHaveBeenCalledTimes(3);
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
