/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

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

  afterEach(() => {
    jest.useRealTimers();
  });

  it('subscribes on mount, configures shared recovery, and unsubscribes on unmount', async () => {
    const onNewTransactions = jest.fn();
    const { unmount } = renderHook(() =>
      useTransactionsWebSocket({
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        currency: 'usd',
        onNewTransactions,
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

  it('passes subscription restore callbacks to shared recovery', () => {
    const onSubscriptionRestored = jest.fn();

    renderHook(() =>
      useTransactionsWebSocket({
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        currency: 'usd',
        onSubscriptionRestored,
      }),
    );

    expect(globalMockBag.__txWsRecoveryHook).toHaveBeenCalledWith({
      enabled: true,
      networkId: 'evm--1',
      tokenAddress: '0xabc',
      currency: 'usd',
      channel: 'tokenTxs',
      onRestored: onSubscriptionRestored,
    });
  });

  it('batches matching transaction updates for one second and clears the tracker count per message', async () => {
    const onNewTransactions = jest.fn();
    renderHook(() =>
      useTransactionsWebSocket({
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        currency: 'usd',
        onNewTransactions,
      }),
    );

    await waitFor(() => {
      expect(globalMockBag.__txWsEventBus?.on).toHaveBeenCalled();
    });

    const marketUpdateHandler = getMarketUpdateHandler();
    expect(marketUpdateHandler).toBeDefined();

    jest.useFakeTimers();

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
      marketUpdateHandler?.({
        channel: 'tokenTxs',
        data: {
          poolId: 'pool-2',
          txHash: '0xtx2',
          owner: '0xowner2',
          side: 'buy',
          blockUnixTime: 1235,
          poolLogoUrl: 'https://example.com/logo-2.png',
          volumeUSD: '84',
          from: {
            symbol: 'CCC',
            amount: '789000000',
            decimals: 6,
            address: '0xdef',
            nearestPrice: '3.5',
          },
          to: {
            symbol: 'AAA',
            amount: '1000000000000000000',
            decimals: 18,
            address: '0xAbC',
            price: '1.5',
          },
        },
      });
    });

    expect(onNewTransactions).not.toHaveBeenCalled();
    expect(globalMockBag.__txWsSvc?.clearDataCount).toHaveBeenCalledTimes(2);

    act(() => {
      jest.advanceTimersByTime(999);
    });

    expect(onNewTransactions).not.toHaveBeenCalled();
    expect(globalMockBag.__txWsSvc?.clearDataCount).toHaveBeenCalledTimes(2);

    act(() => {
      jest.advanceTimersByTime(1);
    });

    expect(globalMockBag.__txWsMarkSubscriptionActivity).toHaveBeenCalledTimes(
      2,
    );
    expect(globalMockBag.__txWsSvc?.clearDataCount).toHaveBeenCalledTimes(2);
    expect(globalMockBag.__txWsSvc?.clearDataCount).toHaveBeenCalledWith({
      address: '0xabc',
      type: 'tokenTxs',
      networkId: 'evm--1',
      currency: 'usd',
    });
    expect(onNewTransactions).toHaveBeenCalledTimes(1);
    expect(onNewTransactions).toHaveBeenCalledWith([
      {
        pairAddress: 'pool-2',
        hash: '0xtx2',
        owner: '0xowner2',
        type: 'buy',
        timestamp: 1235,
        url: '',
        poolLogoUrl: 'https://example.com/logo-2.png',
        volumeUSD: '84',
        from: {
          symbol: 'CCC',
          amount: '789',
          address: '0xdef',
          price: '3.5',
        },
        to: {
          symbol: 'AAA',
          amount: '1',
          address: '0xAbC',
          price: '1.5',
        },
      },
      {
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
      },
    ]);
  });

  it('keeps websocket batches pending while realtime updates are paused', async () => {
    const onNewTransactions = jest.fn();
    const { result, rerender } = renderHook(
      ({ isPaused }: { isPaused: boolean }) =>
        useTransactionsWebSocket({
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          currency: 'usd',
          isPaused,
          onNewTransactions,
        }),
      {
        initialProps: {
          isPaused: true,
        },
      },
    );

    await waitFor(() => {
      expect(globalMockBag.__txWsEventBus?.on).toHaveBeenCalled();
    });

    const marketUpdateHandler = getMarketUpdateHandler();
    expect(marketUpdateHandler).toBeDefined();

    jest.useFakeTimers();

    act(() => {
      marketUpdateHandler?.({
        channel: 'tokenTxs',
        data: {
          poolId: 'pool-1',
          txHash: '0xtx',
          owner: '0xowner',
          side: 'sell',
          blockUnixTime: 1234,
          from: {
            address: '0xAbC',
          },
          to: {
            address: '0xdef',
          },
        },
      });
      jest.advanceTimersByTime(1000);
    });

    expect(onNewTransactions).not.toHaveBeenCalled();
    expect(globalMockBag.__txWsSvc?.clearDataCount).toHaveBeenCalledTimes(1);
    expect(result.current.pendingTransactionsCount).toBe(1);

    act(() => {
      rerender({ isPaused: false });
    });

    expect(globalMockBag.__txWsSvc?.clearDataCount).toHaveBeenCalledTimes(1);
    expect(onNewTransactions).toHaveBeenCalledTimes(1);
    expect(onNewTransactions).toHaveBeenCalledWith([
      expect.objectContaining({
        hash: '0xtx',
        timestamp: 1234,
      }),
    ]);
    expect(result.current.pendingTransactionsCount).toBe(0);
  });

  it('limits pending batches only when maxPendingTransactions is provided', async () => {
    const onNewTransactions = jest.fn();
    const { result, rerender } = renderHook(
      ({ isPaused }: { isPaused: boolean }) =>
        useTransactionsWebSocket({
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          currency: 'usd',
          isPaused,
          maxPendingTransactions: 2,
          onNewTransactions,
        }),
      {
        initialProps: {
          isPaused: true,
        },
      },
    );

    await waitFor(() => {
      expect(globalMockBag.__txWsEventBus?.on).toHaveBeenCalled();
    });

    const marketUpdateHandler = getMarketUpdateHandler();
    expect(marketUpdateHandler).toBeDefined();

    jest.useFakeTimers();

    act(() => {
      marketUpdateHandler?.({
        channel: 'tokenTxs',
        data: {
          txHash: '0xtx1',
          blockUnixTime: 1,
        },
      });
      marketUpdateHandler?.({
        channel: 'tokenTxs',
        data: {
          txHash: '0xtx2',
          blockUnixTime: 2,
        },
      });
      marketUpdateHandler?.({
        channel: 'tokenTxs',
        data: {
          txHash: '0xtx3',
          blockUnixTime: 3,
        },
      });
      jest.advanceTimersByTime(1000);
    });

    expect(globalMockBag.__txWsSvc?.clearDataCount).toHaveBeenCalledTimes(3);
    expect(result.current.pendingTransactionsCount).toBe(2);
    expect(result.current.hasPendingTransactionsOverflow).toBe(true);

    act(() => {
      rerender({ isPaused: false });
    });

    expect(onNewTransactions).toHaveBeenCalledTimes(1);
    const cappedTransactions = onNewTransactions.mock.calls[0][0] as
      | IMarketTokenTransaction[]
      | undefined;
    expect(cappedTransactions?.map((tx) => tx.hash)).toEqual([
      '0xtx3',
      '0xtx2',
    ]);
    expect(result.current.pendingTransactionsCount).toBe(0);
  });

  it('does not limit pending batches by default', async () => {
    const onNewTransactions = jest.fn();
    renderHook(() =>
      useTransactionsWebSocket({
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        currency: 'usd',
        onNewTransactions,
      }),
    );

    await waitFor(() => {
      expect(globalMockBag.__txWsEventBus?.on).toHaveBeenCalled();
    });

    const marketUpdateHandler = getMarketUpdateHandler();
    expect(marketUpdateHandler).toBeDefined();

    jest.useFakeTimers();

    act(() => {
      for (let i = 1; i <= 55; i += 1) {
        marketUpdateHandler?.({
          channel: 'tokenTxs',
          data: {
            txHash: `0xtx${i}`,
            blockUnixTime: i,
          },
        });
      }
      jest.advanceTimersByTime(1000);
    });

    expect(globalMockBag.__txWsSvc?.clearDataCount).toHaveBeenCalledTimes(55);
    expect(onNewTransactions).toHaveBeenCalledTimes(1);
    const uncappedTransactions = onNewTransactions.mock.calls[0][0] as
      | IMarketTokenTransaction[]
      | undefined;
    expect(uncappedTransactions).toHaveLength(55);
    expect(uncappedTransactions?.slice(0, 2).map((tx) => tx.hash)).toEqual([
      '0xtx55',
      '0xtx54',
    ]);
  });

  it('drops pending transaction batches on unmount', async () => {
    const onNewTransactions = jest.fn();
    const { unmount } = renderHook(() =>
      useTransactionsWebSocket({
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        currency: 'usd',
        onNewTransactions,
      }),
    );

    await waitFor(() => {
      expect(globalMockBag.__txWsEventBus?.on).toHaveBeenCalled();
    });

    const marketUpdateHandler = getMarketUpdateHandler();
    expect(marketUpdateHandler).toBeDefined();

    jest.useFakeTimers();

    act(() => {
      marketUpdateHandler?.({
        channel: 'tokenTxs',
        data: {
          txHash: '0xtx',
          blockUnixTime: 1234,
          from: {
            address: '0xAbC',
          },
          to: {
            address: '0xdef',
          },
        },
      });
    });

    unmount();

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(globalMockBag.__txWsMarkSubscriptionActivity).toHaveBeenCalledTimes(
      1,
    );
    expect(globalMockBag.__txWsSvc?.clearDataCount).toHaveBeenCalledTimes(1);
    expect(onNewTransactions).not.toHaveBeenCalled();
  });

  it('ignores transaction updates for other tokens', async () => {
    const onNewTransactions = jest.fn();
    renderHook(() =>
      useTransactionsWebSocket({
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        currency: 'usd',
        onNewTransactions,
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
    expect(onNewTransactions).not.toHaveBeenCalled();
  });
});
