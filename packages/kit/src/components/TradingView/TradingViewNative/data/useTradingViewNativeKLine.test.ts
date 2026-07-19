/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import { fetchMarketKLineDataWithSlicing } from '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketKLineData';
import type {
  IMarketTokenKLineDataPoint,
  IMarketTokenKLineResponse,
} from '@onekeyhq/shared/types/marketV2';

import { fetchTradingViewNativeHyperliquidKLine } from './fetchTradingViewNativeHyperliquidKLine';
import { useTradingViewNativeKLine } from './useTradingViewNativeKLine';

const globalMockBag = globalThis as typeof globalThis & {
  __tradingViewNativeHyperliquidWsHook?: jest.Mock;
  __tradingViewNativeMarketWsHook?: jest.Mock;
};

jest.mock(
  '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketKLineData',
  () => ({
    fetchMarketKLineDataWithSlicing: jest.fn(),
  }),
);

jest.mock('./fetchTradingViewNativeHyperliquidKLine', () => ({
  fetchTradingViewNativeHyperliquidKLine: jest.fn(),
}));

jest.mock('./useTradingViewNativeHyperliquidWebSocket', () => {
  const useTradingViewNativeHyperliquidWebSocket = jest.fn();
  (globalThis as any).__tradingViewNativeHyperliquidWsHook =
    useTradingViewNativeHyperliquidWebSocket;
  return { useTradingViewNativeHyperliquidWebSocket };
});

jest.mock('./useTradingViewNativeMarketWebSocket', () => {
  const useTradingViewNativeMarketWebSocket = jest.fn();
  (globalThis as any).__tradingViewNativeMarketWsHook =
    useTradingViewNativeMarketWebSocket;
  return { useTradingViewNativeMarketWebSocket };
});

const mockFetchMarketKLineDataWithSlicing =
  fetchMarketKLineDataWithSlicing as jest.MockedFunction<
    typeof fetchMarketKLineDataWithSlicing
  >;
const mockFetchTradingViewNativeHyperliquidKLine =
  fetchTradingViewNativeHyperliquidKLine as jest.MockedFunction<
    typeof fetchTradingViewNativeHyperliquidKLine
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

function createDeferredResponse<T = IMarketTokenKLineResponse | null>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function pushRealtimePoint(
  point: IMarketTokenKLineDataPoint,
  provider: 'hyperliquid' | 'market' = 'market',
) {
  const websocketHook =
    provider === 'hyperliquid'
      ? globalMockBag.__tradingViewNativeHyperliquidWsHook
      : globalMockBag.__tradingViewNativeMarketWsHook;
  const latestHookParams = websocketHook?.mock.calls.at(-1)?.[0] as
    | {
        onKLineUpdate: (nextPoint: IMarketTokenKLineDataPoint) => void;
      }
    | undefined;
  act(() => {
    latestHookParams?.onKLineUpdate(point);
  });
}

describe('TradingViewNative K-line data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the previous candles until a non-empty interval response arrives', async () => {
    const initialRequest = createDeferredResponse();
    const intervalRequest = createDeferredResponse();
    mockFetchMarketKLineDataWithSlicing
      .mockReturnValueOnce(initialRequest.promise)
      .mockReturnValueOnce(intervalRequest.promise);

    const { result } = renderHook(() =>
      useTradingViewNativeKLine({
        networkId: 'evm--1',
        tokenAddress: '0x123',
      }),
    );

    await act(async () => {
      initialRequest.resolve(buildResponse(100));
      await initialRequest.promise;
    });
    await waitFor(() => expect(result.current.points[0]?.c).toBe(100));
    expect(result.current.candleIntervalSeconds).toBe(60 * 60);

    act(() => result.current.handleIntervalChange('1'));
    await waitFor(() =>
      expect(mockFetchMarketKLineDataWithSlicing).toHaveBeenCalledTimes(2),
    );
    expect(result.current.points[0]?.c).toBe(100);
    expect(result.current.candleIntervalSeconds).toBe(60 * 60);
    expect(result.current.intervalConfig.activeInterval).toBe('1');
    expect(result.current.isSwitchingInterval).toBe(true);

    await act(async () => {
      intervalRequest.resolve({ points: [], total: 0 });
      await intervalRequest.promise;
    });
    await waitFor(() =>
      expect(result.current.intervalConfig.activeInterval).toBe('60'),
    );
    expect(result.current.points[0]?.c).toBe(100);
    expect(result.current.isSwitchingInterval).toBe(false);
  });

  it('hides another token immediately and ignores an obsolete response', async () => {
    const firstRequest = createDeferredResponse();
    const secondRequest = createDeferredResponse();
    mockFetchMarketKLineDataWithSlicing
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    const { result, rerender } = renderHook(
      ({ tokenAddress }: { tokenAddress: string }) =>
        useTradingViewNativeKLine({
          networkId: 'evm--1',
          tokenAddress,
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

  it('replaces the current candle and appends the next realtime candle', async () => {
    mockFetchMarketKLineDataWithSlicing.mockResolvedValue(buildResponse(100));

    const { result } = renderHook(() =>
      useTradingViewNativeKLine({
        networkId: 'evm--1',
        tokenAddress: '0x123',
        symbol: 'TOKEN',
        dataSource: 'market-websocket',
      }),
    );

    await waitFor(() => expect(result.current.points[0]?.c).toBe(100));
    expect(
      globalMockBag.__tradingViewNativeMarketWsHook,
    ).toHaveBeenLastCalledWith(
      expect.objectContaining({
        enabled: true,
        networkId: 'evm--1',
        tokenAddress: '0x123',
        symbol: 'TOKEN',
        chartType: '60',
      }),
    );

    pushRealtimePoint({
      o: 100,
      h: 106,
      l: 99,
      c: 105,
      v: 12,
      t: 100,
    });
    expect(result.current.points).toHaveLength(1);
    expect(result.current.points[0]?.c).toBe(105);

    pushRealtimePoint({
      o: 105,
      h: 111,
      l: 104,
      c: 110,
      v: 8,
      t: 200,
    });
    expect(result.current.points).toHaveLength(2);
    expect(result.current.points[1]?.c).toBe(110);
  });

  it('uses Hyperliquid history and WebSocket data for a configured BTC ticker', async () => {
    mockFetchTradingViewNativeHyperliquidKLine.mockResolvedValue(
      buildResponse(63_000),
    );

    const { result } = renderHook(() =>
      useTradingViewNativeKLine({
        networkId: 'btc--0',
        tokenAddress: '',
        symbol: 'BTC',
        hyperliquidCoin: 'BTC',
        dataSource: 'hyperliquid',
      }),
    );

    await waitFor(() => expect(result.current.points[0]?.c).toBe(63_000));
    expect(mockFetchMarketKLineDataWithSlicing).not.toHaveBeenCalled();
    expect(mockFetchTradingViewNativeHyperliquidKLine).toHaveBeenCalledWith(
      expect.objectContaining({
        coin: 'BTC',
        interval: '60',
      }),
    );
    expect(result.current.dataProviderKey).toBe('hyperliquid:BTC');
    expect(
      globalMockBag.__tradingViewNativeMarketWsHook,
    ).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
    expect(
      globalMockBag.__tradingViewNativeHyperliquidWsHook,
    ).toHaveBeenLastCalledWith(
      expect.objectContaining({
        enabled: true,
        coin: 'BTC',
        chartInterval: '60',
      }),
    );

    pushRealtimePoint(
      {
        o: 63_000,
        h: 64_100,
        l: 62_900,
        c: 64_000,
        v: 12,
        t: 63_000,
      },
      'hyperliquid',
    );
    expect(result.current.points).toEqual([
      expect.objectContaining({ c: 64_000, t: 63_000 }),
    ]);
  });

  it('keeps all realtime candles received while interval history is loading', async () => {
    const initialRequest = createDeferredResponse();
    const intervalRequest = createDeferredResponse();
    mockFetchMarketKLineDataWithSlicing
      .mockReturnValueOnce(initialRequest.promise)
      .mockReturnValueOnce(intervalRequest.promise);

    const { result } = renderHook(() =>
      useTradingViewNativeKLine({
        networkId: 'evm--1',
        tokenAddress: '0x123',
        symbol: 'TOKEN',
        dataSource: 'market-websocket',
      }),
    );

    await act(async () => {
      initialRequest.resolve(buildResponse(100));
      await initialRequest.promise;
    });
    await waitFor(() => expect(result.current.points[0]?.c).toBe(100));

    act(() => result.current.handleIntervalChange('1'));
    await waitFor(() => {
      expect(mockFetchMarketKLineDataWithSlicing).toHaveBeenCalledTimes(2);
      expect(
        globalMockBag.__tradingViewNativeMarketWsHook,
      ).toHaveBeenLastCalledWith(expect.objectContaining({ chartType: '1' }));
    });

    pushRealtimePoint({
      o: 200,
      h: 206,
      l: 199,
      c: 205,
      v: 5,
      t: 200,
    });
    pushRealtimePoint({
      o: 205,
      h: 211,
      l: 204,
      c: 210,
      v: 6,
      t: 300,
    });
    expect(result.current.points[0]?.c).toBe(100);

    await act(async () => {
      intervalRequest.resolve(buildResponse(150));
      await intervalRequest.promise;
    });
    await waitFor(() => expect(result.current.points).toHaveLength(3));
    expect(result.current.points.map((point) => point.c)).toEqual([
      150, 205, 210,
    ]);
    expect(result.current.isSwitchingInterval).toBe(false);
  });

  it('clears buffered realtime candles when the token scope changes', async () => {
    const initialTokenRequest = createDeferredResponse();
    const secondTokenRequest = createDeferredResponse();
    const returnedTokenRequest = createDeferredResponse();
    mockFetchMarketKLineDataWithSlicing
      .mockReturnValueOnce(initialTokenRequest.promise)
      .mockReturnValueOnce(secondTokenRequest.promise)
      .mockReturnValueOnce(returnedTokenRequest.promise);

    const { result, rerender } = renderHook(
      ({ tokenAddress }: { tokenAddress: string }) =>
        useTradingViewNativeKLine({
          networkId: 'evm--1',
          tokenAddress,
          symbol: 'TOKEN',
          dataSource: 'market-websocket',
        }),
      { initialProps: { tokenAddress: '0xaaa' } },
    );

    await act(async () => {
      initialTokenRequest.resolve(buildResponse(100));
      await initialTokenRequest.promise;
    });
    await waitFor(() => expect(result.current.points[0]?.c).toBe(100));

    pushRealtimePoint({
      o: 100,
      h: 106,
      l: 99,
      c: 105,
      v: 12,
      t: 100,
    });
    expect(result.current.points[0]?.c).toBe(105);

    rerender({ tokenAddress: '0xbbb' });
    await waitFor(() =>
      expect(mockFetchMarketKLineDataWithSlicing).toHaveBeenCalledTimes(2),
    );
    await act(async () => {
      secondTokenRequest.resolve(buildResponse(200));
      await secondTokenRequest.promise;
    });
    await waitFor(() => expect(result.current.points[0]?.c).toBe(200));

    rerender({ tokenAddress: '0xaaa' });
    await waitFor(() =>
      expect(mockFetchMarketKLineDataWithSlicing).toHaveBeenCalledTimes(3),
    );
    await act(async () => {
      returnedTokenRequest.resolve(buildResponse(120, 100));
      await returnedTokenRequest.promise;
    });

    await waitFor(() => expect(result.current.points[0]?.c).toBe(120));
    expect(result.current.points).toHaveLength(1);
  });

  it('aborts pending Hyperliquid history when the chart unmounts', async () => {
    const request = createDeferredResponse<IMarketTokenKLineResponse>();
    mockFetchTradingViewNativeHyperliquidKLine.mockReturnValue(request.promise);

    const { unmount } = renderHook(() =>
      useTradingViewNativeKLine({
        networkId: 'btc--0',
        tokenAddress: '',
        symbol: 'BTC',
        hyperliquidCoin: 'BTC',
        dataSource: 'hyperliquid',
      }),
    );

    await waitFor(() =>
      expect(mockFetchTradingViewNativeHyperliquidKLine).toHaveBeenCalledTimes(
        1,
      ),
    );
    const signal =
      mockFetchTradingViewNativeHyperliquidKLine.mock.calls[0]?.[0].signal;
    expect(signal?.aborted).toBe(false);

    unmount();
    expect(signal?.aborted).toBe(true);

    await act(async () => {
      request.resolve(buildResponse(63_000));
      await request.promise;
    });
  });
});
