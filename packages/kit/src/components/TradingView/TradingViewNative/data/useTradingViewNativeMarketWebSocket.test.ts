/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { useTradingViewNativeMarketWebSocket } from './useTradingViewNativeMarketWebSocket';

const globalMockBag = globalThis as typeof globalThis & {
  __tradingViewNativeMarketWsService?: {
    connect: jest.Mock;
    subscribeOHLCV: jest.Mock;
    unsubscribeOHLCV: jest.Mock;
    clearDataCount: jest.Mock;
  };
  __tradingViewNativeMarketWsEventBus?: {
    on: jest.Mock;
    off: jest.Mock;
  };
  __tradingViewNativeMarketWsRecovery?: jest.Mock;
  __tradingViewNativeMarketWsMarkActivity?: jest.Mock;
  __tradingViewNativeMarketWsLogError?: jest.Mock;
};

type IMarketUpdateHandler = (payload: {
  channel: string;
  tokenAddress: string;
  networkId?: string;
  isSubscriptionAmbiguous?: boolean;
  data: unknown;
}) => void;

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const service = {
    connect: jest.fn().mockResolvedValue(undefined),
    subscribeOHLCV: jest.fn().mockResolvedValue(undefined),
    unsubscribeOHLCV: jest.fn().mockResolvedValue(undefined),
    clearDataCount: jest.fn().mockResolvedValue(undefined),
  };
  (globalThis as any).__tradingViewNativeMarketWsService = service;
  return {
    __esModule: true,
    default: {
      serviceMarketWS: service,
    },
  };
});

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => {
  const eventBus = {
    on: jest.fn(),
    off: jest.fn(),
  };
  (globalThis as any).__tradingViewNativeMarketWsEventBus = eventBus;
  return {
    EAppEventBusNames: {
      MarketWSDataUpdate: 'MarketWSDataUpdate',
    },
    appEventBus: eventBus,
  };
});

jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  const error = jest.fn();
  (globalThis as any).__tradingViewNativeMarketWsLogError = error;
  return {
    defaultLogger: {
      networkDoctor: { log: { error } },
    },
  };
});

jest.mock(
  '@onekeyhq/kit/src/views/Market/hooks/useMarketWSSubscriptionRecovery',
  () => {
    const markSubscriptionActivity = jest.fn();
    const recovery = jest.fn(() => ({
      markSubscriptionActivity,
      restoreSubscription: jest.fn(),
    }));
    (globalThis as any).__tradingViewNativeMarketWsRecovery = recovery;
    (globalThis as any).__tradingViewNativeMarketWsMarkActivity =
      markSubscriptionActivity;
    return {
      useMarketWSSubscriptionRecovery: recovery,
    };
  },
);

function getMarketUpdateHandler() {
  return globalMockBag.__tradingViewNativeMarketWsEventBus?.on.mock.calls.find(
    ([eventName]) => eventName === 'MarketWSDataUpdate',
  )?.[1] as IMarketUpdateHandler | undefined;
}

function buildPriceData(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    address: '0xabc',
    symbol: 'TOKEN',
    type: '1h',
    unixTime: 3600,
    o: 100,
    h: 110,
    l: 90,
    c: 105,
    v: 20,
    ...overrides,
  };
}

describe('TradingViewNative Market WebSocket data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalMockBag.__tradingViewNativeMarketWsService?.connect.mockResolvedValue(
      undefined,
    );
    globalMockBag.__tradingViewNativeMarketWsService?.clearDataCount.mockResolvedValue(
      undefined,
    );
  });

  it('subscribes to the selected interval and cleans up on unmount', async () => {
    const onKLineUpdate = jest.fn();
    const { unmount } = renderHook(() =>
      useTradingViewNativeMarketWebSocket({
        enabled: true,
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        symbol: 'TOKEN',
        chartType: '60',
        onKLineUpdate,
      }),
    );

    const subscription = {
      networkId: 'evm--1',
      tokenAddress: '0xabc',
      symbol: 'TOKEN',
      chartType: '1h',
      currency: 'usd',
    };
    await waitFor(() => {
      expect(
        globalMockBag.__tradingViewNativeMarketWsService?.subscribeOHLCV,
      ).toHaveBeenCalledWith(subscription);
    });
    expect(
      globalMockBag.__tradingViewNativeMarketWsRecovery,
    ).toHaveBeenCalledWith({
      enabled: true,
      networkId: 'evm--1',
      tokenAddress: '0xabc',
      symbol: 'TOKEN',
      chartType: '1h',
      currency: 'usd',
      channel: 'ohlcv',
    });

    unmount();

    await waitFor(() => {
      expect(
        globalMockBag.__tradingViewNativeMarketWsService?.unsubscribeOHLCV,
      ).toHaveBeenCalledWith(subscription);
    });
  });

  it('normalizes matching market updates into chart points', async () => {
    const onKLineUpdate = jest.fn();
    renderHook(() =>
      useTradingViewNativeMarketWebSocket({
        enabled: true,
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        symbol: 'TOKEN',
        chartType: '60',
        onKLineUpdate,
      }),
    );

    await waitFor(() => expect(getMarketUpdateHandler()).toBeDefined());
    const marketUpdateHandler = getMarketUpdateHandler();

    act(() => {
      marketUpdateHandler?.({
        channel: 'ohlcv',
        tokenAddress: '0xabc',
        networkId: 'evm--1',
        data: buildPriceData(),
      });
    });

    const expectedPoint: IMarketTokenKLineDataPoint = {
      o: 100,
      h: 110,
      l: 90,
      c: 105,
      v: 20,
      t: 3600,
    };
    expect(onKLineUpdate).toHaveBeenCalledWith(expectedPoint);
    expect(
      globalMockBag.__tradingViewNativeMarketWsMarkActivity,
    ).toHaveBeenCalledTimes(1);
    expect(
      globalMockBag.__tradingViewNativeMarketWsService?.clearDataCount,
    ).toHaveBeenCalledWith({
      address: '0xabc',
      type: 'ohlcv',
      networkId: 'evm--1',
      chartType: '1h',
      currency: 'usd',
    });
  });

  it('filters updates from another token, network, or interval', async () => {
    const onKLineUpdate = jest.fn();
    renderHook(() =>
      useTradingViewNativeMarketWebSocket({
        enabled: true,
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        symbol: 'TOKEN',
        chartType: '60',
        onKLineUpdate,
      }),
    );

    await waitFor(() => expect(getMarketUpdateHandler()).toBeDefined());
    const marketUpdateHandler = getMarketUpdateHandler();

    act(() => {
      marketUpdateHandler?.({
        channel: 'ohlcv',
        tokenAddress: '0xdef',
        networkId: 'evm--1',
        data: buildPriceData(),
      });
      marketUpdateHandler?.({
        channel: 'ohlcv',
        tokenAddress: '0xabc',
        networkId: 'evm--137',
        data: buildPriceData(),
      });
      marketUpdateHandler?.({
        channel: 'ohlcv',
        tokenAddress: '0xabc',
        networkId: 'evm--1',
        data: buildPriceData({ type: '1m' }),
      });
    });

    expect(onKLineUpdate).not.toHaveBeenCalled();
    expect(
      globalMockBag.__tradingViewNativeMarketWsService?.clearDataCount,
    ).not.toHaveBeenCalled();
  });

  it('handles clear-data-count failures without an unhandled rejection', async () => {
    const clearDataCountError = new Error('background bridge unavailable');
    globalMockBag.__tradingViewNativeMarketWsService?.clearDataCount.mockRejectedValueOnce(
      clearDataCountError,
    );
    renderHook(() =>
      useTradingViewNativeMarketWebSocket({
        enabled: true,
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        symbol: 'TOKEN',
        chartType: '60',
        onKLineUpdate: jest.fn(),
      }),
    );

    await waitFor(() => expect(getMarketUpdateHandler()).toBeDefined());
    act(() => {
      getMarketUpdateHandler()?.({
        channel: 'ohlcv',
        tokenAddress: '0xabc',
        networkId: 'evm--1',
        data: buildPriceData(),
      });
    });

    await waitFor(() => {
      expect(
        globalMockBag.__tradingViewNativeMarketWsLogError,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          info: expect.stringContaining('background bridge unavailable'),
        }),
      );
    });
  });

  it('routes native-token updates by symbol when the address is empty', async () => {
    const onKLineUpdate = jest.fn();
    renderHook(() =>
      useTradingViewNativeMarketWebSocket({
        enabled: true,
        networkId: 'btc--0',
        tokenAddress: '',
        symbol: 'BTC',
        chartType: '1',
        onKLineUpdate,
      }),
    );

    await waitFor(() => {
      expect(
        globalMockBag.__tradingViewNativeMarketWsService?.subscribeOHLCV,
      ).toHaveBeenCalledWith({
        networkId: 'btc--0',
        tokenAddress: '',
        symbol: 'BTC',
        chartType: '1m',
        currency: 'usd',
      });
      expect(getMarketUpdateHandler()).toBeDefined();
    });
    const marketUpdateHandler = getMarketUpdateHandler();

    act(() => {
      marketUpdateHandler?.({
        channel: 'ohlcv',
        tokenAddress: '',
        networkId: 'btc--0',
        data: buildPriceData({
          address: '',
          symbol: 'ETH',
          type: '1m',
        }),
      });
      marketUpdateHandler?.({
        channel: 'ohlcv',
        tokenAddress: '',
        networkId: 'btc--0',
        data: buildPriceData({
          address: '',
          symbol: 'btc',
          type: '1m',
        }),
      });
    });

    expect(onKLineUpdate).toHaveBeenCalledTimes(1);
  });

  it('does not subscribe after an in-flight connection is cancelled', async () => {
    let resolveConnect: (() => void) | undefined;
    globalMockBag.__tradingViewNativeMarketWsService?.connect.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveConnect = resolve;
        }),
    );
    const { unmount } = renderHook(() =>
      useTradingViewNativeMarketWebSocket({
        enabled: true,
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        symbol: 'TOKEN',
        chartType: '60',
        onKLineUpdate: jest.fn(),
      }),
    );

    unmount();
    await act(async () => {
      resolveConnect?.();
      await Promise.resolve();
    });

    expect(
      globalMockBag.__tradingViewNativeMarketWsService?.subscribeOHLCV,
    ).not.toHaveBeenCalled();
  });
});
