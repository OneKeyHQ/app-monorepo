/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useTransactionsWebSocket } from './useTransactionsWebSocket';

const globalMockBag = globalThis as typeof globalThis & {
  __txWsSvc?: {
    connect: jest.Mock;
    subscribeTokenTxs: jest.Mock;
    unsubscribeTokenTxs: jest.Mock;
    clearDataCount: jest.Mock;
  };
  __txWsEventBus?: {
    on: jest.Mock;
    off: jest.Mock;
  };
  __txWsRecoveryHook?: jest.Mock;
  __txWsMarkSubscriptionActivity?: jest.Mock;
};

type IMarketUpdateHandler = (payload: {
  channel: string;
  data: Record<string, unknown>;
}) => void;

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const svc = {
    connect: jest.fn().mockResolvedValue(undefined),
    subscribeTokenTxs: jest.fn().mockResolvedValue(undefined),
    unsubscribeTokenTxs: jest.fn().mockResolvedValue(undefined),
    clearDataCount: jest.fn().mockResolvedValue(undefined),
  };
  (globalThis as any).__txWsSvc = svc;
  return {
    __esModule: true,
    default: {
      serviceMarketWS: svc,
    },
  };
});

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => {
  const eventBus = {
    on: jest.fn(),
    off: jest.fn(),
  };
  (globalThis as any).__txWsEventBus = eventBus;
  return {
    EAppEventBusNames: {
      MarketWSDataUpdate: 'MarketWSDataUpdate',
    },
    appEventBus: eventBus,
  };
});

jest.mock(
  '@onekeyhq/kit/src/views/Market/hooks/useMarketWSSubscriptionRecovery',
  () => {
    const markSubscriptionActivity = jest.fn();
    const recoveryHook = jest.fn(() => ({
      markSubscriptionActivity,
      restoreSubscription: jest.fn(),
    }));
    (globalThis as any).__txWsRecoveryHook = recoveryHook;
    (globalThis as any).__txWsMarkSubscriptionActivity =
      markSubscriptionActivity;
    return {
      useMarketWSSubscriptionRecovery: recoveryHook,
    };
  },
);

function getMarketUpdateHandler() {
  return globalMockBag.__txWsEventBus?.on.mock.calls.find(
    ([eventName]) => eventName === 'MarketWSDataUpdate',
  )?.[1] as IMarketUpdateHandler | undefined;
}

describe('useTransactionsWebSocket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('subscribes on mount, configures shared recovery, and unsubscribes on unmount', async () => {
    const onNewTransaction = jest.fn();
    const { unmount } = renderHook(() =>
      useTransactionsWebSocket({
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        currency: 'usd',
        onNewTransaction,
      }),
    );

    await waitFor(() => {
      expect(globalMockBag.__txWsSvc?.connect).toHaveBeenCalledTimes(1);
      expect(globalMockBag.__txWsSvc?.subscribeTokenTxs).toHaveBeenCalledWith({
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        currency: 'usd',
      });
    });

    expect(globalMockBag.__txWsRecoveryHook).toHaveBeenCalledWith({
      enabled: true,
      networkId: 'evm--1',
      tokenAddress: '0xabc',
      currency: 'usd',
      channel: 'tokenTxs',
    });

    unmount();

    await waitFor(() => {
      expect(globalMockBag.__txWsSvc?.unsubscribeTokenTxs).toHaveBeenCalledWith(
        {
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          currency: 'usd',
        },
      );
    });
  });

  it('maps matching transaction updates and clears the tracker count', async () => {
    const onNewTransaction = jest.fn();
    renderHook(() =>
      useTransactionsWebSocket({
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        currency: 'usd',
        onNewTransaction,
      }),
    );

    await waitFor(() => {
      expect(globalMockBag.__txWsEventBus?.on).toHaveBeenCalled();
    });

    const marketUpdateHandler = getMarketUpdateHandler();
    expect(marketUpdateHandler).toBeDefined();

    act(() => {
      marketUpdateHandler?.({
        channel: 'tokenTxs',
        data: {
          poolId: 'pool-1',
          txHash: '0xtx',
          owner: '0xowner',
          side: 'sell',
          blockUnixTime: 1234,
          poolLogoUrl: 'https://example.com/logo.png',
          volumeUSD: '42',
          from: {
            symbol: 'AAA',
            amount: '123000000',
            decimals: 6,
            address: '0xAbC',
            price: '1.5',
          },
          to: {
            symbol: 'BBB',
            amount: '456000000000000000',
            decimals: 18,
            address: '0xdef',
            nearestPrice: '2.5',
          },
        },
      });
    });

    await waitFor(() => {
      expect(
        globalMockBag.__txWsMarkSubscriptionActivity,
      ).toHaveBeenCalledTimes(1);
      expect(globalMockBag.__txWsSvc?.clearDataCount).toHaveBeenCalledWith({
        address: '0xabc',
        type: 'tokenTxs',
      });
      expect(onNewTransaction).toHaveBeenCalledWith({
        pairAddress: 'pool-1',
        hash: '0xtx',
        owner: '0xowner',
        type: 'sell',
        timestamp: 1234,
        url: '',
        poolLogoUrl: 'https://example.com/logo.png',
        volumeUSD: '42',
        from: {
          symbol: 'AAA',
          amount: '123',
          address: '0xAbC',
          price: '1.5',
        },
        to: {
          symbol: 'BBB',
          amount: '0.456',
          address: '0xdef',
          price: '2.5',
        },
      });
    });
  });

  it('ignores transaction updates for other tokens', async () => {
    const onNewTransaction = jest.fn();
    renderHook(() =>
      useTransactionsWebSocket({
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        currency: 'usd',
        onNewTransaction,
      }),
    );

    await waitFor(() => {
      expect(globalMockBag.__txWsEventBus?.on).toHaveBeenCalled();
    });

    const marketUpdateHandler = getMarketUpdateHandler();
    act(() => {
      marketUpdateHandler?.({
        channel: 'tokenTxs',
        data: {
          from: {
            address: '0x111',
          },
          to: {
            address: '0x222',
          },
        },
      });
    });

    expect(globalMockBag.__txWsSvc?.clearDataCount).not.toHaveBeenCalled();
    expect(onNewTransaction).not.toHaveBeenCalled();
  });
});
