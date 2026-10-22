/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import {
  getCurrentPerpsMarketDataFreshness,
  usePerpsMarketDataFreshness,
} from './usePerpsMarketDataFreshness';

let mockConnected = true;
let mockSocketOpen = true;
let mockLastMessageAt = 1_000_000;
const mockSubscribers = new Set<() => void>();
const mockSubscribe = (callback: () => void) => {
  mockSubscribers.add(callback);
  return () => mockSubscribers.delete(callback);
};

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  perpsNetworkStatusAtom: {
    atom: () => 'network',
    sub: (callback: () => void) => mockSubscribe(callback),
  },
  perpsWebSocketConnectedAtom: {
    atom: () => 'socket',
    sub: (callback: () => void) => mockSubscribe(callback),
  },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore', () => ({
  jotaiDefaultStore: {
    get: (atom: string) =>
      atom === 'network'
        ? { connected: mockConnected, lastMessageAt: mockLastMessageAt }
        : mockSocketOpen,
  },
}));

describe('current market readiness at order review and confirmation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1_000_000);
    mockConnected = true;
    mockSocketOpen = true;
    mockLastMessageAt = Date.now();
    mockSubscribers.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects a quote that expires while confirmation is open without a render', () => {
    expect(getCurrentPerpsMarketDataFreshness().isReady).toBe(true);

    jest.advanceTimersByTime(6001);
    expect(getCurrentPerpsMarketDataFreshness().reason).toBe('stale');

    mockLastMessageAt = Date.now();
    expect(getCurrentPerpsMarketDataFreshness().isReady).toBe(true);
  });

  it('allows the liveness update grace window but rejects data after it expires', () => {
    jest.advanceTimersByTime(5001);
    expect(getCurrentPerpsMarketDataFreshness().isReady).toBe(true);

    jest.advanceTimersByTime(999);
    expect(getCurrentPerpsMarketDataFreshness().isReady).toBe(true);

    jest.advanceTimersByTime(1);
    expect(getCurrentPerpsMarketDataFreshness().reason).toBe('stale');
  });

  it('preserves an explicitly requested freshness threshold', () => {
    jest.advanceTimersByTime(5001);
    expect(getCurrentPerpsMarketDataFreshness(5000).reason).toBe('stale');
  });

  it('checks the latest socket and network state on each press', () => {
    expect(getCurrentPerpsMarketDataFreshness().isReady).toBe(true);

    mockSocketOpen = false;
    expect(getCurrentPerpsMarketDataFreshness().reason).toBe('socket_not_open');

    mockSocketOpen = true;
    mockConnected = false;
    expect(getCurrentPerpsMarketDataFreshness().reason).toBe(
      'network_disconnected',
    );

    mockConnected = true;
    expect(getCurrentPerpsMarketDataFreshness().isReady).toBe(true);
  });

  it('keeps mounted controls and confirmation aligned through the grace boundary', () => {
    jest.setSystemTime(mockLastMessageAt + 5500);
    const { result } = renderHook(() => usePerpsMarketDataFreshness());
    expect(result.current.isReady).toBe(true);
    expect(getCurrentPerpsMarketDataFreshness().isReady).toBe(true);

    act(() => jest.advanceTimersByTime(500));
    expect(result.current.isReady).toBe(true);
    expect(getCurrentPerpsMarketDataFreshness().isReady).toBe(true);

    act(() => jest.advanceTimersByTime(1));
    expect(result.current.reason).toBe('stale');
    expect(getCurrentPerpsMarketDataFreshness().reason).toBe('stale');
  });

  it('rearms the controls expiry timer when fresh market data arrives', () => {
    const { result } = renderHook(() => usePerpsMarketDataFreshness());
    act(() => jest.advanceTimersByTime(5000));
    act(() => {
      mockLastMessageAt = Date.now();
      mockSubscribers.forEach((callback) => callback());
    });
    act(() => jest.advanceTimersByTime(1001));
    expect(result.current.isReady).toBe(true);
    act(() => jest.advanceTimersByTime(4999));
    expect(result.current.isReady).toBe(true);
    act(() => jest.advanceTimersByTime(1));
    expect(result.current.reason).toBe('stale');
  });

  it('honors an explicit controls threshold without adding another grace period', () => {
    const { result } = renderHook(() =>
      usePerpsMarketDataFreshness({ staleMs: 3000 }),
    );
    act(() => jest.advanceTimersByTime(3000));
    expect(result.current.isReady).toBe(true);
    act(() => jest.advanceTimersByTime(1));
    expect(result.current.reason).toBe('stale');
    expect(getCurrentPerpsMarketDataFreshness(3000).reason).toBe('stale');
  });

  it('immediately blocks mounted controls on socket or network loss', () => {
    const { result } = renderHook(() => usePerpsMarketDataFreshness());
    act(() => {
      mockSocketOpen = false;
      mockSubscribers.forEach((callback) => callback());
    });
    expect(result.current.reason).toBe('socket_not_open');
    act(() => {
      mockSocketOpen = true;
      mockConnected = false;
      mockSubscribers.forEach((callback) => callback());
    });
    expect(result.current.reason).toBe('network_disconnected');
  });
});
