/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  MARKET_WS_SUBSCRIPTION_SELF_HEAL_INTERVAL,
  MARKET_WS_SUBSCRIPTION_STALE_THRESHOLD,
  useMarketWSSubscriptionRecovery,
} from './useMarketWSSubscriptionRecovery';

let visibilityHandler: ((visible: boolean) => void) | undefined;
let currentVisibilityState = true;
let currentNow = 1_000_000;
const removeVisibilitySubscription = jest.fn();
const globalMockBag = globalThis as typeof globalThis & {
  __marketRecoverySvc?: {
    connect: jest.Mock;
    ensureSubscription: jest.Mock;
  };
  __marketRecoveryInterval?: {
    callback: () => void;
    delay: number | null | undefined;
  };
};

jest.mock('@onekeyhq/components/src/hooks/useVisibilityChange', () => ({
  getCurrentVisibilityState: jest.fn(() => currentVisibilityState),
  onVisibilityStateChange: jest.fn((callback: (visible: boolean) => void) => {
    visibilityHandler = callback;
    return removeVisibilitySubscription;
  }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const svc = {
    connect: jest.fn().mockResolvedValue(undefined),
    ensureSubscription: jest.fn().mockResolvedValue(undefined),
  };
  (globalThis as any).__marketRecoverySvc = svc;
  return {
    __esModule: true,
    default: {
      serviceMarketWS: svc,
    },
  };
});

jest.mock('@onekeyhq/kit/src/hooks/useInterval', () => ({
  useInterval: jest.fn(
    (callback: () => void, delay: number | null | undefined) => {
      (globalThis as any).__marketRecoveryInterval = { callback, delay };
    },
  ),
}));

describe('useMarketWSSubscriptionRecovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    visibilityHandler = undefined;
    currentVisibilityState = true;
    currentNow = 1_000_000;
    globalMockBag.__marketRecoveryInterval = undefined;
    jest.spyOn(Date, 'now').mockImplementation(() => currentNow);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('restores token tx subscriptions when visibility recovers', async () => {
    renderHook(() =>
      useMarketWSSubscriptionRecovery({
        enabled: true,
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        currency: 'usd',
        channel: 'tokenTxs',
      }),
    );

    await waitFor(() => {
      expect(typeof visibilityHandler).toBe('function');
    });

    act(() => {
      visibilityHandler?.(true);
    });

    await waitFor(() => {
      expect(globalMockBag.__marketRecoverySvc?.connect).toHaveBeenCalledTimes(
        1,
      );
      expect(
        globalMockBag.__marketRecoverySvc?.ensureSubscription,
      ).toHaveBeenCalledWith({
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        currency: 'usd',
        chartType: undefined,
        channel: 'tokenTxs',
      });
    });
  });

  it('notifies callers after a subscription is restored', async () => {
    const onRestored = jest.fn();
    renderHook(() =>
      useMarketWSSubscriptionRecovery({
        enabled: true,
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        currency: 'usd',
        channel: 'tokenTxs',
        onRestored,
      }),
    );

    await waitFor(() => {
      expect(typeof visibilityHandler).toBe('function');
    });

    act(() => {
      visibilityHandler?.(true);
    });

    await waitFor(() => {
      expect(onRestored).toHaveBeenCalledTimes(1);
    });
  });

  it('restores ohlcv subscriptions with chart type when visibility recovers', async () => {
    renderHook(() =>
      useMarketWSSubscriptionRecovery({
        enabled: true,
        networkId: 'evm--137',
        tokenAddress: '0xdef',
        currency: 'usd',
        chartType: '1m',
        channel: 'ohlcv',
      }),
    );

    await waitFor(() => {
      expect(typeof visibilityHandler).toBe('function');
    });

    act(() => {
      visibilityHandler?.(true);
    });

    await waitFor(() => {
      expect(
        globalMockBag.__marketRecoverySvc?.ensureSubscription,
      ).toHaveBeenCalledWith({
        networkId: 'evm--137',
        tokenAddress: '0xdef',
        currency: 'usd',
        chartType: '1m',
        channel: 'ohlcv',
      });
    });
  });

  it('restores subscriptions only after data has been stale for one minute', async () => {
    const { result } = renderHook(() =>
      useMarketWSSubscriptionRecovery({
        enabled: true,
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        currency: 'usd',
        chartType: '1m',
        channel: 'ohlcv',
      }),
    );

    await waitFor(() => {
      expect(globalMockBag.__marketRecoveryInterval?.delay).toBe(
        MARKET_WS_SUBSCRIPTION_SELF_HEAL_INTERVAL,
      );
    });

    jest.clearAllMocks();

    act(() => {
      currentNow += MARKET_WS_SUBSCRIPTION_STALE_THRESHOLD - 1;
      globalMockBag.__marketRecoveryInterval?.callback();
    });

    expect(globalMockBag.__marketRecoverySvc?.connect).not.toHaveBeenCalled();
    expect(
      globalMockBag.__marketRecoverySvc?.ensureSubscription,
    ).not.toHaveBeenCalled();

    act(() => {
      result.current.markSubscriptionActivity();
      currentNow += MARKET_WS_SUBSCRIPTION_STALE_THRESHOLD - 1;
      globalMockBag.__marketRecoveryInterval?.callback();
    });

    expect(globalMockBag.__marketRecoverySvc?.connect).not.toHaveBeenCalled();
    expect(
      globalMockBag.__marketRecoverySvc?.ensureSubscription,
    ).not.toHaveBeenCalled();

    act(() => {
      currentNow += 1;
      globalMockBag.__marketRecoveryInterval?.callback();
    });

    await waitFor(() => {
      expect(globalMockBag.__marketRecoverySvc?.connect).toHaveBeenCalledTimes(
        1,
      );
      expect(
        globalMockBag.__marketRecoverySvc?.ensureSubscription,
      ).toHaveBeenCalledWith({
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        currency: 'usd',
        chartType: '1m',
        channel: 'ohlcv',
      });
    });
  });

  it('pauses the self-heal interval while hidden and resumes on visibility recovery', async () => {
    renderHook(() =>
      useMarketWSSubscriptionRecovery({
        enabled: true,
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        currency: 'usd',
        chartType: '1m',
        channel: 'ohlcv',
      }),
    );

    await waitFor(() => {
      expect(globalMockBag.__marketRecoveryInterval?.delay).toBe(
        MARKET_WS_SUBSCRIPTION_SELF_HEAL_INTERVAL,
      );
    });

    act(() => {
      currentVisibilityState = false;
      visibilityHandler?.(false);
    });

    await waitFor(() => {
      expect(globalMockBag.__marketRecoveryInterval?.delay ?? null).toBeNull();
    });

    jest.clearAllMocks();

    act(() => {
      currentVisibilityState = true;
      visibilityHandler?.(true);
    });

    await waitFor(() => {
      expect(globalMockBag.__marketRecoveryInterval?.delay).toBe(
        MARKET_WS_SUBSCRIPTION_SELF_HEAL_INTERVAL,
      );
      expect(
        globalMockBag.__marketRecoverySvc?.ensureSubscription,
      ).toHaveBeenCalledWith({
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        currency: 'usd',
        chartType: '1m',
        channel: 'ohlcv',
      });
    });
  });

  it('does not register recovery when disabled', async () => {
    renderHook(() =>
      useMarketWSSubscriptionRecovery({
        enabled: false,
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        currency: 'usd',
        channel: 'tokenTxs',
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(globalMockBag.__marketRecoverySvc?.connect).not.toHaveBeenCalled();
    expect(
      globalMockBag.__marketRecoverySvc?.ensureSubscription,
    ).not.toHaveBeenCalled();
    expect(visibilityHandler).toBeUndefined();
    expect(globalMockBag.__marketRecoveryInterval?.delay ?? null).toBeNull();
  });

  it('does not restore after unmount while a restore call is in flight', async () => {
    let resolveConnect: (() => void) | undefined;
    globalMockBag.__marketRecoverySvc?.connect.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveConnect = resolve;
        }),
    );

    const { unmount } = renderHook(() =>
      useMarketWSSubscriptionRecovery({
        enabled: true,
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        currency: 'usd',
        channel: 'tokenTxs',
      }),
    );

    await waitFor(() => {
      expect(globalMockBag.__marketRecoveryInterval?.delay).toBe(
        MARKET_WS_SUBSCRIPTION_SELF_HEAL_INTERVAL,
      );
    });

    jest.clearAllMocks();

    act(() => {
      currentNow += MARKET_WS_SUBSCRIPTION_STALE_THRESHOLD;
      globalMockBag.__marketRecoveryInterval?.callback();
      unmount();
    });

    await act(async () => {
      resolveConnect?.();
      await Promise.resolve();
    });

    expect(
      globalMockBag.__marketRecoverySvc?.ensureSubscription,
    ).not.toHaveBeenCalled();
  });

  it('invalidates an in-flight restore when the subscription key changes', async () => {
    let resolveConnect: (() => void) | undefined;
    globalMockBag.__marketRecoverySvc?.connect.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveConnect = resolve;
        }),
    );

    const { rerender } = renderHook(
      ({ currency, chartType }: { currency: string; chartType?: string }) =>
        useMarketWSSubscriptionRecovery({
          enabled: true,
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          currency,
          chartType,
          channel: 'tokenTxs',
        }),
      {
        initialProps: {
          currency: 'usd',
          chartType: undefined,
        },
      },
    );

    await waitFor(() => {
      expect(typeof visibilityHandler).toBe('function');
    });

    act(() => {
      visibilityHandler?.(true);
    });

    rerender({
      currency: 'cny',
      chartType: undefined,
    });

    await act(async () => {
      resolveConnect?.();
      await Promise.resolve();
    });

    expect(
      globalMockBag.__marketRecoverySvc?.ensureSubscription,
    ).not.toHaveBeenCalledWith({
      networkId: 'evm--1',
      tokenAddress: '0xabc',
      currency: 'usd',
      chartType: undefined,
      channel: 'tokenTxs',
    });
  });
});
