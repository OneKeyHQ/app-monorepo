/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import type { ICandle } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { useTradingViewNativeHyperliquidWebSocket } from './useTradingViewNativeHyperliquidWebSocket';

type ICandleListener = (candle: ICandle) => void;
type IVisibilityListener = (visible: boolean) => void;

const globalMockBag = globalThis as typeof globalThis & {
  __tradingViewNativeHyperliquidCandle?: jest.Mock;
  __tradingViewNativeHyperliquidClose?: jest.Mock;
  __tradingViewNativeHyperliquidUnsubscribe?: jest.Mock;
  __tradingViewNativeHyperliquidWebSocketTransport?: jest.Mock;
  __tradingViewNativeVisibilityListener?: IVisibilityListener;
  __tradingViewNativeGetVisibility?: jest.Mock;
  __tradingViewNativeHyperliquidLogError?: jest.Mock;
};

jest.mock('@nktkas/hyperliquid', () => {
  const unsubscribe = jest.fn().mockResolvedValue(undefined);
  const candle = jest.fn().mockResolvedValue({ unsubscribe });
  const close = jest.fn().mockResolvedValue(undefined);
  const transport = { close };
  const WebSocketTransport = jest.fn(() => transport);
  const SubscriptionClient = jest.fn(() => ({ candle }));
  const bag = globalThis as typeof globalThis & {
    __tradingViewNativeHyperliquidCandle?: jest.Mock;
    __tradingViewNativeHyperliquidClose?: jest.Mock;
    __tradingViewNativeHyperliquidUnsubscribe?: jest.Mock;
    __tradingViewNativeHyperliquidWebSocketTransport?: jest.Mock;
  };
  bag.__tradingViewNativeHyperliquidCandle = candle;
  bag.__tradingViewNativeHyperliquidClose = close;
  bag.__tradingViewNativeHyperliquidUnsubscribe = unsubscribe;
  bag.__tradingViewNativeHyperliquidWebSocketTransport = WebSocketTransport;

  return { SubscriptionClient, WebSocketTransport };
});

jest.mock('@onekeyhq/components/src/hooks/useVisibilityChange', () => {
  const getCurrentVisibilityState = jest.fn(() => true);
  (
    globalThis as typeof globalThis & {
      __tradingViewNativeGetVisibility?: jest.Mock;
    }
  ).__tradingViewNativeGetVisibility = getCurrentVisibilityState;

  return {
    getCurrentVisibilityState,
    onVisibilityStateChange: jest.fn((listener: IVisibilityListener) => {
      (
        globalThis as typeof globalThis & {
          __tradingViewNativeVisibilityListener?: IVisibilityListener;
        }
      ).__tradingViewNativeVisibilityListener = listener;
      return jest.fn();
    }),
  };
});

jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  const error = jest.fn();
  (globalThis as any).__tradingViewNativeHyperliquidLogError = error;
  return {
    defaultLogger: {
      networkDoctor: { log: { error } },
    },
  };
});

function buildCandle(overrides: Partial<ICandle> = {}): ICandle {
  return {
    t: 1_720_000_000_000,
    T: 1_720_003_599_999,
    s: 'BTC',
    i: '1h',
    o: '63000',
    h: '64000',
    l: '62000',
    c: '63500',
    v: '15',
    n: 10,
    ...overrides,
  };
}

function getCandleListener(): ICandleListener | undefined {
  return globalMockBag.__tradingViewNativeHyperliquidCandle?.mock.calls.at(
    -1,
  )?.[1] as ICandleListener | undefined;
}

describe('TradingViewNative Hyperliquid WebSocket data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalMockBag.__tradingViewNativeGetVisibility?.mockReturnValue(true);
    globalMockBag.__tradingViewNativeHyperliquidCandle?.mockResolvedValue({
      unsubscribe: globalMockBag.__tradingViewNativeHyperliquidUnsubscribe,
    });
  });

  it('subscribes to candles, normalizes updates, and cleans up', async () => {
    const onKLineUpdate = jest.fn();
    const { unmount } = renderHook(() =>
      useTradingViewNativeHyperliquidWebSocket({
        enabled: true,
        coin: 'BTC',
        chartInterval: '60',
        onKLineUpdate,
      }),
    );

    await waitFor(() => {
      expect(
        globalMockBag.__tradingViewNativeHyperliquidCandle,
      ).toHaveBeenCalledWith(
        { coin: 'BTC', interval: '1h' },
        expect.any(Function),
      );
    });
    expect(
      globalMockBag.__tradingViewNativeHyperliquidWebSocketTransport,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        resubscribe: true,
        reconnect: expect.objectContaining({ maxRetries: 999 }),
      }),
    );

    act(() => getCandleListener()?.(buildCandle()));
    expect(onKLineUpdate).toHaveBeenCalledWith({
      o: 63_000,
      h: 64_000,
      l: 62_000,
      c: 63_500,
      v: 15,
      t: 1_720_000_000,
    });

    act(() => getCandleListener()?.(buildCandle({ s: 'ETH' })));
    expect(onKLineUpdate).toHaveBeenCalledTimes(1);

    unmount();
    await waitFor(() => {
      expect(
        globalMockBag.__tradingViewNativeHyperliquidUnsubscribe,
      ).toHaveBeenCalledTimes(1);
      expect(
        globalMockBag.__tradingViewNativeHyperliquidClose,
      ).toHaveBeenCalledTimes(1);
    });
  });

  it('recreates the direct subscription after returning to the foreground', async () => {
    renderHook(() =>
      useTradingViewNativeHyperliquidWebSocket({
        enabled: true,
        coin: 'BTC',
        chartInterval: '60',
        onKLineUpdate: jest.fn(),
      }),
    );
    await waitFor(() =>
      expect(
        globalMockBag.__tradingViewNativeHyperliquidCandle,
      ).toHaveBeenCalledTimes(1),
    );

    act(() => globalMockBag.__tradingViewNativeVisibilityListener?.(false));
    await waitFor(() =>
      expect(
        globalMockBag.__tradingViewNativeHyperliquidClose,
      ).toHaveBeenCalledTimes(1),
    );

    act(() => globalMockBag.__tradingViewNativeVisibilityListener?.(true));
    await waitFor(() =>
      expect(
        globalMockBag.__tradingViewNativeHyperliquidCandle,
      ).toHaveBeenCalledTimes(2),
    );
  });

  it('logs direct subscription failures with the project logger', async () => {
    globalMockBag.__tradingViewNativeHyperliquidCandle?.mockRejectedValueOnce(
      new Error('subscription unavailable'),
    );

    renderHook(() =>
      useTradingViewNativeHyperliquidWebSocket({
        enabled: true,
        coin: 'BTC',
        chartInterval: '60',
        onKLineUpdate: jest.fn(),
      }),
    );

    await waitFor(() => {
      expect(
        globalMockBag.__tradingViewNativeHyperliquidLogError,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          info: expect.stringContaining('subscription unavailable'),
        }),
      );
    });
  });
});
