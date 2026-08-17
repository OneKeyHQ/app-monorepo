/**
 * @jest-environment jsdom
 */

import type { RefObject } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { IWebViewRef } from '@onekeyhq/kit/src/components/WebView/types';

import { useTradingViewV2WebSocket } from './useTradingViewV2WebSocket';

const globalMockBag = globalThis as typeof globalThis & {
  __tradingViewWsSvc?: {
    connect: jest.Mock;
    subscribeOHLCV: jest.Mock;
    unsubscribeOHLCV: jest.Mock;
    clearDataCount: jest.Mock;
  };
  __tradingViewWsEventBus?: {
    on: jest.Mock;
    off: jest.Mock;
  };
  __tradingViewWsRecoveryHook?: jest.Mock;
  __tradingViewWsMarkSubscriptionActivity?: jest.Mock;
};

type IMarketUpdateHandler = (payload: {
  channel: string;
  tokenAddress: string;
  networkId?: string;
  data: unknown;
}) => void;

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const serviceMarketWS = {
    connect: jest.fn().mockResolvedValue(undefined),
    subscribeOHLCV: jest.fn().mockResolvedValue(undefined),
    unsubscribeOHLCV: jest.fn().mockResolvedValue(undefined),
    clearDataCount: jest.fn().mockResolvedValue(undefined),
  };
  (
    globalThis as typeof globalThis & {
      __tradingViewWsSvc?: typeof serviceMarketWS;
    }
  ).__tradingViewWsSvc = serviceMarketWS;
  return {
    __esModule: true,
    default: { serviceMarketWS },
  };
});

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => {
  const appEventBus = {
    on: jest.fn(),
    off: jest.fn(),
  };
  (
    globalThis as typeof globalThis & {
      __tradingViewWsEventBus?: typeof appEventBus;
    }
  ).__tradingViewWsEventBus = appEventBus;
  return {
    EAppEventBusNames: {
      MarketWSDataUpdate: 'MarketWSDataUpdate',
    },
    appEventBus,
  };
});

jest.mock(
  '@onekeyhq/kit/src/views/Market/hooks/useMarketWSSubscriptionRecovery',
  () => {
    const markSubscriptionActivity = jest.fn();
    const recoveryHook = jest.fn(() => ({ markSubscriptionActivity }));
    (
      globalThis as typeof globalThis & {
        __tradingViewWsRecoveryHook?: typeof recoveryHook;
        __tradingViewWsMarkSubscriptionActivity?: typeof markSubscriptionActivity;
      }
    ).__tradingViewWsRecoveryHook = recoveryHook;
    (
      globalThis as typeof globalThis & {
        __tradingViewWsMarkSubscriptionActivity?: typeof markSubscriptionActivity;
      }
    ).__tradingViewWsMarkSubscriptionActivity = markSubscriptionActivity;
    return { useMarketWSSubscriptionRecovery: recoveryHook };
  },
);

jest.mock('../messageHandlers/volumeVisibilityHandler', () => ({
  sendVolumeVisibilityUpdate: jest.fn(),
}));

function getMarketUpdateHandler() {
  return globalMockBag.__tradingViewWsEventBus?.on.mock.calls.find(
    ([eventName]) => eventName === 'MarketWSDataUpdate',
  )?.[1] as IMarketUpdateHandler | undefined;
}

describe('useTradingViewV2WebSocket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['120', '2h'],
    ['2H', '2h'],
    ['480', '8h'],
    ['8H', '8h'],
    ['720', '12h'],
    ['12H', '12h'],
    ['3D', '3d'],
  ])(
    'subscribes to %s with the canonical %s interval',
    async (chartType, expected) => {
      renderHook(() =>
        useTradingViewV2WebSocket({
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          webRef: { current: null },
          chartType,
        }),
      );

      await waitFor(() => {
        expect(
          globalMockBag.__tradingViewWsSvc?.subscribeOHLCV,
        ).toHaveBeenCalledWith({
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          chartType: expected,
          currency: 'usd',
        });
      });
      expect(globalMockBag.__tradingViewWsRecoveryHook).toHaveBeenCalledWith(
        expect.objectContaining({ chartType: expected }),
      );
    },
  );

  it('accepts lowercase realtime data for an uppercase expanded interval', async () => {
    const sendMessageViaInjectedScript = jest.fn();
    const webRef = {
      current: { sendMessageViaInjectedScript },
    } as unknown as RefObject<IWebViewRef | null>;
    jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    renderHook(() =>
      useTradingViewV2WebSocket({
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        webRef,
        chartType: '2H',
      }),
    );

    await waitFor(() => {
      expect(getMarketUpdateHandler()).toBeDefined();
    });
    const marketUpdateHandler = getMarketUpdateHandler();

    act(() => {
      marketUpdateHandler?.({
        channel: 'ohlcv',
        tokenAddress: '0xabc',
        networkId: 'evm--1',
        data: {
          o: 1,
          h: 2,
          l: 1,
          c: 2,
          v: 3,
          eventType: 'ohlcv',
          type: '4h',
          unixTime: 900,
          symbol: 'ABC',
          address: '0xabc',
        },
      });
    });
    expect(sendMessageViaInjectedScript).not.toHaveBeenCalled();

    act(() => {
      marketUpdateHandler?.({
        channel: 'ohlcv',
        tokenAddress: '0xabc',
        networkId: 'evm--1',
        data: {
          o: 1,
          h: 2,
          l: 1,
          c: 2,
          v: 3,
          eventType: 'ohlcv',
          type: '2h',
          unixTime: 900,
          symbol: 'ABC',
          address: '0xabc',
        },
      });
    });

    expect(
      globalMockBag.__tradingViewWsMarkSubscriptionActivity,
    ).toHaveBeenCalledTimes(1);
    expect(sendMessageViaInjectedScript).toHaveBeenCalledWith({
      type: 'autoKLineUpdate',
      payload: expect.objectContaining({
        type: 'realtime',
        subscriptionIdentity: {
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          resolution: '2H',
        },
      }),
    });
  });
});
