/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import { useTradingViewSubIndicatorCount } from './useTradingViewSubIndicatorCount';

const DEFAULT_COUNT = 1;
const STABILIZATION_DELAY_MS = 500;

function useTestSubIndicatorCount({
  chartKey = 'chart-a',
  stabilizeInitialCount = true,
}: {
  chartKey?: string;
  stabilizeInitialCount?: boolean;
}) {
  return useTradingViewSubIndicatorCount({
    chartKey,
    defaultCount: DEFAULT_COUNT,
    stabilizeInitialCount,
    stabilizationDelayMs: STABILIZATION_DELAY_MS,
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
      result.current[1](2);
    });

    expect(result.current[0]).toBe(2);
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
