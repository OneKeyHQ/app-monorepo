/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import {
  type ITradingViewNativeIntervalStorageNamespace,
  readTradingViewNativeActiveInterval,
  saveTradingViewNativeActiveInterval,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/data/tradingViewNativeIntervalStorage';

import { useTradingViewIntervalSync } from './useTradingViewIntervalSync';

import type { ITradingViewIntervalConfigData } from '../../../types';

const mockStorage = new Map<string, unknown>();
jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: {
    syncStorage: {
      getObject: (key: string) => mockStorage.get(key),
      setObject: (key: string, value: unknown) => mockStorage.set(key, value),
    },
  },
}));

function config(
  activeInterval: string,
  persist = true,
): ITradingViewIntervalConfigData {
  return {
    activeInterval,
    intervals: ['1', '15', '60', '240', '1D', '1W'].map((value) => ({
      label: value,
      value,
    })),
    persist,
  };
}

describe('chart mode interval synchronization', () => {
  beforeEach(() => mockStorage.clear());
  afterEach(() => jest.useRealTimers());

  it('keeps the TradingView default when no shared preference exists', () => {
    const onIntervalChange = jest.fn();
    const { result } = renderHook(() =>
      useTradingViewIntervalSync({
        namespace: 'token',
        intervalConfig: config('1'),
        isReady: true,
        onIntervalChange,
      }),
    );
    expect(result.current.initialInterval).toBeUndefined();
    expect(onIntervalChange).not.toHaveBeenCalled();
    expect(readTradingViewNativeActiveInterval('token')).toBe('1');
  });

  it('keeps the latest selection through Original → TradingView → Original', async () => {
    await saveTradingViewNativeActiveInterval({
      interval: '15',
      namespace: 'token',
    });
    const onIntervalChange = jest.fn();
    const { result, rerender, unmount } = renderHook(
      ({ intervalConfig, isReady }) =>
        useTradingViewIntervalSync({
          namespace: 'token',
          intervalConfig,
          isReady,
          onIntervalChange,
        }),
      { initialProps: { intervalConfig: config('60'), isReady: false } },
    );
    expect(result.current.initialInterval).toBe('15');
    expect(result.current.displayedIntervalConfig?.activeInterval).toBe('15');
    expect(result.current.isRestoringInterval).toBe(true);
    expect(onIntervalChange).not.toHaveBeenCalled();
    rerender({ intervalConfig: config('60'), isReady: true });
    expect(onIntervalChange).toHaveBeenCalledWith('15');
    rerender({ intervalConfig: config('60'), isReady: true });
    expect(onIntervalChange).toHaveBeenCalledTimes(1);
    expect(readTradingViewNativeActiveInterval('token')).toBe('15');
    rerender({ intervalConfig: config('15'), isReady: true });
    expect(result.current.isRestoringInterval).toBe(false);
    act(() => result.current.saveInterval('60'));
    rerender({ intervalConfig: config('60', false), isReady: true });
    // A delayed configuration must not undo the user's latest choice.
    rerender({ intervalConfig: config('15'), isReady: true });
    expect(readTradingViewNativeActiveInterval('token')).toBe('60');
    expect(result.current.displayedIntervalConfig?.activeInterval).toBe('60');
    expect(result.current.isRestoringInterval).toBe(true);
    rerender({ intervalConfig: config('60'), isReady: true });
    expect(result.current.initialInterval).toBe('15');
    unmount();
    expect(readTradingViewNativeActiveInterval('token')).toBe('60');
  });

  it('preserves an immediate selection when the chart is unmounted before acknowledgement', () => {
    const { result, unmount } = renderHook(() =>
      useTradingViewIntervalSync({
        namespace: 'token',
        intervalConfig: config('60'),
        isReady: true,
        onIntervalChange: jest.fn(),
      }),
    );
    act(() => result.current.saveInterval('15'));
    unmount();
    expect(readTradingViewNativeActiveInterval('token')).toBe('15');
  });

  it('reapplies a selection made before layout restoration finishes', () => {
    const onIntervalChange = jest.fn();
    const { result, rerender } = renderHook(
      ({ isReady }) =>
        useTradingViewIntervalSync({
          namespace: 'token',
          intervalConfig: config('15'),
          isReady,
          onIntervalChange,
        }),
      { initialProps: { isReady: false } },
    );
    act(() => result.current.saveInterval('240'));
    rerender({ isReady: true });
    expect(onIntervalChange).toHaveBeenLastCalledWith('240');
    expect(result.current.displayedIntervalConfig?.activeInterval).toBe('240');
  });

  it('does not save automatic fallback intervals and handles hour aliases', () => {
    const { result, rerender } = renderHook(
      ({ intervalConfig }) =>
        useTradingViewIntervalSync({
          namespace: 'market-hyperliquid',
          intervalConfig,
          isReady: true,
          onIntervalChange: jest.fn(),
        }),
      { initialProps: { intervalConfig: config('60') } },
    );
    rerender({ intervalConfig: config('1D', false) });
    expect(readTradingViewNativeActiveInterval('market-hyperliquid')).toBe(
      '60',
    );
    act(() => result.current.saveInterval('4H'));
    expect(readTradingViewNativeActiveInterval('market-hyperliquid')).toBe(
      '240',
    );
  });

  it('isolates source namespaces and restarts synchronization after a reload', async () => {
    await saveTradingViewNativeActiveInterval({
      interval: '15',
      namespace: 'token',
    });
    await saveTradingViewNativeActiveInterval({
      interval: '240',
      namespace: 'stock',
    });
    const onIntervalChange = jest.fn();
    const { result, rerender } = renderHook(
      ({
        namespace,
      }: {
        namespace: ITradingViewNativeIntervalStorageNamespace;
      }) =>
        useTradingViewIntervalSync({
          namespace,
          intervalConfig: config('60'),
          isReady: true,
          onIntervalChange,
        }),
      { initialProps: { namespace: 'token' } },
    );
    rerender({ namespace: 'stock' });
    expect(onIntervalChange).toHaveBeenLastCalledWith('240');
    expect(readTradingViewNativeActiveInterval('token')).toBe('15');
    act(() => result.current.reset());
    rerender({ namespace: 'stock' });
    expect(onIntervalChange).toHaveBeenCalledTimes(3);
  });

  it('leaves charts without synchronization and unsupported intervals alone', async () => {
    await saveTradingViewNativeActiveInterval({
      interval: '30',
      namespace: 'token',
    });
    const onIntervalChange = jest.fn();
    renderHook(() =>
      useTradingViewIntervalSync({
        namespace: 'token',
        intervalConfig: config('60'),
        isReady: true,
        onIntervalChange,
      }),
    );
    renderHook(() =>
      useTradingViewIntervalSync({
        intervalConfig: config('15'),
        isReady: true,
        onIntervalChange,
      }),
    );
    expect(onIntervalChange).not.toHaveBeenCalled();
    expect(readTradingViewNativeActiveInterval('token')).toBe('30');
  });

  it('releases a rejected restoration without saving its automatic fallback', async () => {
    jest.useFakeTimers();
    await saveTradingViewNativeActiveInterval({
      interval: '1',
      namespace: 'token',
    });
    const onIntervalChange = jest.fn();
    const { result, rerender } = renderHook(
      ({ intervalConfig }) =>
        useTradingViewIntervalSync({
          namespace: 'token',
          intervalConfig,
          isReady: true,
          onIntervalChange,
        }),
      { initialProps: { intervalConfig: config('60', false) } },
    );
    expect(onIntervalChange).toHaveBeenCalledWith('1');
    rerender({ intervalConfig: config('1', false) });
    rerender({ intervalConfig: config('1D', false) });
    act(() => jest.advanceTimersByTime(4999));
    expect(result.current.isRestoringInterval).toBe(true);
    // Further fallback messages must not extend the deadline.
    rerender({ intervalConfig: config('1D', false) });
    act(() => jest.advanceTimersByTime(1));
    expect(result.current.isRestoringInterval).toBe(false);
    expect(result.current.displayedIntervalConfig?.activeInterval).toBe('1D');
    expect(readTradingViewNativeActiveInterval('token')).toBe('1');
    expect(onIntervalChange).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('gives a new selection its own deadline and cancels it on acknowledgement', () => {
    jest.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ intervalConfig }) =>
        useTradingViewIntervalSync({
          namespace: 'token',
          intervalConfig,
          isReady: true,
          onIntervalChange: jest.fn(),
        }),
      { initialProps: { intervalConfig: config('60') } },
    );
    act(() => result.current.saveInterval('1'));
    rerender({ intervalConfig: config('1D', false) });
    act(() => jest.advanceTimersByTime(4000));
    act(() => result.current.saveInterval('15'));
    act(() => jest.advanceTimersByTime(1000));
    expect(result.current.isRestoringInterval).toBe(true);
    expect(result.current.displayedIntervalConfig?.activeInterval).toBe('15');
    expect(readTradingViewNativeActiveInterval('token')).toBe('15');
    rerender({ intervalConfig: config('15') });
    expect(result.current.isRestoringInterval).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('waits for layout readiness after a reload and cleans up on unmount', async () => {
    jest.useFakeTimers();
    await saveTradingViewNativeActiveInterval({
      interval: '15',
      namespace: 'token',
    });
    const { result, rerender, unmount } = renderHook(
      ({ intervalConfig, isReady }) =>
        useTradingViewIntervalSync({
          namespace: 'token',
          intervalConfig,
          isReady,
          onIntervalChange: jest.fn(),
        }),
      { initialProps: { intervalConfig: config('60', false), isReady: true } },
    );
    act(() => jest.advanceTimersByTime(4000));
    act(() => result.current.reset());
    rerender({ intervalConfig: config('60', false), isReady: false });
    act(() => jest.advanceTimersByTime(10_000));
    expect(result.current.isRestoringInterval).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
    rerender({ intervalConfig: config('60', false), isReady: true });
    act(() => jest.advanceTimersByTime(1000));
    expect(result.current.isRestoringInterval).toBe(true);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
    expect(readTradingViewNativeActiveInterval('token')).toBe('15');
  });
});
