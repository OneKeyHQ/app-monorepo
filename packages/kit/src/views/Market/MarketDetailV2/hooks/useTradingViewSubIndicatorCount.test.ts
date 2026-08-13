/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import { useTradingViewSubIndicatorCount } from './useTradingViewSubIndicatorCount';

const DEFAULT_COUNT = 1;
const MAX_COUNT = 4;
const STABILIZATION_DELAY_MS = 500;

function useTestSubIndicatorCount({
  chartKey = 'chart-a',
  initialCount = DEFAULT_COUNT,
  stabilizeInitialCount = true,
  onCountSettled,
}: {
  chartKey?: string;
  initialCount?: number;
  stabilizeInitialCount?: boolean;
  onCountSettled?: (count: number) => void;
}) {
  return useTradingViewSubIndicatorCount({
    chartKey,
    initialCount,
    maxCount: MAX_COUNT,
    stabilizeInitialCount,
    stabilizationDelayMs: STABILIZATION_DELAY_MS,
    onCountSettled,
  });
}

describe('useTradingViewSubIndicatorCount', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('coalesces provisional TradingView counts during initial layout restoration', () => {
    const { result } = renderHook(() => useTestSubIndicatorCount({}));

    act(() => {
      result.current[1](0);
      jest.advanceTimersByTime(250);
      result.current[1](1);
      jest.advanceTimersByTime(STABILIZATION_DELAY_MS - 1);
    });

    expect(result.current[0]).toBe(DEFAULT_COUNT);

    act(() => {
      jest.advanceTimersByTime(1);
    });

    expect(result.current[0]).toBe(1);

    act(() => {
      result.current[1](2);
    });

    expect(result.current[0]).toBe(2);
  });

  it('uses the app-persisted count until TradingView confirms layout restoration', () => {
    const onCountSettled = jest.fn();
    const { result } = renderHook(() =>
      useTestSubIndicatorCount({
        initialCount: 2,
        onCountSettled,
      }),
    );

    act(() => {
      result.current[1](0, { layoutRestored: false });
      jest.advanceTimersByTime(250);
      result.current[1](1, { layoutRestored: false });
      jest.advanceTimersByTime(STABILIZATION_DELAY_MS);
    });

    expect(result.current[0]).toBe(2);
    expect(onCountSettled).not.toHaveBeenCalled();

    act(() => {
      result.current[1](2, { layoutRestored: true });
    });

    expect(result.current[0]).toBe(2);
    expect(onCountSettled).toHaveBeenCalledWith(2);

    act(() => {
      result.current[1](3, { layoutRestored: true });
    });

    expect(result.current[0]).toBe(3);
  });

  it('falls back to a quiet legacy WebView count when the restored marker is unavailable', () => {
    const onCountSettled = jest.fn();
    const { result } = renderHook(() =>
      useTestSubIndicatorCount({
        initialCount: 2,
        onCountSettled,
      }),
    );

    act(() => {
      result.current[1](3);
      jest.advanceTimersByTime(STABILIZATION_DELAY_MS - 1);
    });

    expect(result.current[0]).toBe(2);

    act(() => {
      jest.advanceTimersByTime(1);
    });

    expect(result.current[0]).toBe(3);
    expect(onCountSettled).toHaveBeenCalledWith(3);
  });

  it('persists a settled count even when it matches the initial fallback', () => {
    const onCountSettled = jest.fn();
    const { result } = renderHook(() =>
      useTestSubIndicatorCount({ onCountSettled }),
    );

    act(() => {
      result.current[1](DEFAULT_COUNT);
      jest.advanceTimersByTime(STABILIZATION_DELAY_MS);
    });

    expect(result.current[0]).toBe(DEFAULT_COUNT);
    expect(onCountSettled).toHaveBeenCalledWith(DEFAULT_COUNT);
  });

  it('commits a stable initial count after the grace period', () => {
    const { result } = renderHook(() => useTestSubIndicatorCount({}));

    act(() => {
      result.current[1](0);
      jest.advanceTimersByTime(STABILIZATION_DELAY_MS);
    });

    expect(result.current[0]).toBe(0);
  });

  it('applies counts immediately when initial stabilization is disabled', () => {
    const { result } = renderHook(() =>
      useTestSubIndicatorCount({ stabilizeInitialCount: false }),
    );

    act(() => {
      result.current[1](0);
    });

    expect(result.current[0]).toBe(0);
  });

  it('clamps persisted and reported counts to the supported mobile range', () => {
    const { result } = renderHook(() =>
      useTestSubIndicatorCount({
        initialCount: 8,
        stabilizeInitialCount: false,
      }),
    );

    expect(result.current[0]).toBe(MAX_COUNT);

    act(() => {
      result.current[1](9);
    });

    expect(result.current[0]).toBe(MAX_COUNT);
  });

  it('cancels a pending count when the active chart changes', () => {
    const { result, rerender } = renderHook(
      ({ chartKey }: { chartKey: string }) =>
        useTestSubIndicatorCount({ chartKey }),
      { initialProps: { chartKey: 'chart-a' } },
    );

    act(() => {
      result.current[1](2);
    });
    rerender({ chartKey: 'chart-b' });

    act(() => {
      jest.advanceTimersByTime(STABILIZATION_DELAY_MS);
    });

    expect(result.current[0]).toBe(DEFAULT_COUNT);
  });
});
