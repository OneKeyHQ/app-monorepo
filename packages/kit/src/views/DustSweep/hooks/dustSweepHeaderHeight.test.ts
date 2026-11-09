/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import {
  resetDeviceSettledHeaderHeightForTest,
  useSettledHeaderHeight,
} from '../../Earn/hooks/useSettledHeaderHeight';

import { getDustSweepHeaderHeightForSettling } from './dustSweepHeaderHeight';

describe('Dust Sweep header height during navigation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetDeviceSettledHeaderHeightForTest();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps the measured inset when the nested stack briefly reports a bar without its top inset', () => {
    const options = {
      enabled: true,
      cacheKey: 'dust-sweep:tab:400x800',
      estimatedHeaderHeight: 60,
    };
    const getHeight = (headerHeight: number) =>
      getDustSweepHeaderHeightForSettling({
        headerHeight,
        estimatedHeaderHeight: 60,
        useTransparentHeader: true,
      });
    const first = renderHook(() =>
      useSettledHeaderHeight(getHeight(70), options),
    );
    act(() => jest.advanceTimersByTime(64));
    expect(first.result.current.paddingTop).toBe(70);
    first.unmount();

    const next = renderHook(
      ({ height }) => useSettledHeaderHeight(getHeight(height), options),
      { initialProps: { height: 44 } },
    );
    expect(next.result.current).toEqual({ paddingTop: 70, isSettled: true });
    act(() => jest.advanceTimersByTime(200));
    expect(next.result.current.paddingTop).toBe(70);
    next.rerender({ height: 70 });
    act(() => jest.advanceTimersByTime(64));
    expect(next.result.current.paddingTop).toBe(70);
  });

  it('does not reuse a height from another screen or window shape', () => {
    const options = { enabled: true, estimatedHeaderHeight: 60 };
    const previous = renderHook(() =>
      useSettledHeaderHeight(70, { ...options, cacheKey: 'another-page' }),
    );
    act(() => jest.advanceTimersByTime(64));
    previous.unmount();
    const next = renderHook(() =>
      useSettledHeaderHeight(60, {
        ...options,
        cacheKey: 'dust-sweep:tab:800x400',
      }),
    );
    expect(next.result.current.isSettled).toBe(false);
  });

  it('waits for the first native measurement instead of caching the partial bar height', () => {
    const options = {
      enabled: true,
      cacheKey: 'dust-sweep:tab:400x800',
      estimatedHeaderHeight: 60,
    };
    const next = renderHook(
      ({ height }) =>
        useSettledHeaderHeight(
          getDustSweepHeaderHeightForSettling({
            headerHeight: height,
            estimatedHeaderHeight: 60,
            useTransparentHeader: true,
          }),
          options,
        ),
      { initialProps: { height: 44 } },
    );
    act(() => jest.advanceTimersByTime(100));
    expect(next.result.current.isSettled).toBe(false);
    next.rerender({ height: 70 });
    act(() => jest.advanceTimersByTime(64));
    expect(next.result.current).toEqual({ paddingTop: 70, isSettled: true });
  });

  it('preserves the native height outside the transparent iOS tab', () => {
    expect(
      getDustSweepHeaderHeightForSettling({
        headerHeight: 44,
        estimatedHeaderHeight: 60,
        useTransparentHeader: false,
      }),
    ).toBe(44);
  });
});
