/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';

import { TradingViewNativeMultiChartSyncContext } from '../multiChart/TradingViewNativeMultiChartSyncContext';
import { createTradingViewNativeViewportSyncChannel } from '../multiChart/viewportSync';

import { useChartViewportSync } from './useChartViewportSync';

import type { ITradingViewNativeMultiChartSyncScope } from '../multiChart/TradingViewNativeMultiChartSyncContext';
import type { ITradingViewNativeViewportSyncChannel } from '../multiChart/viewportSync';

const viewport = (toTime: number) => ({
  toTime,
  rightGap: 0.1,
  fromTime: toTime - 3600,
  span: 0.8,
});

function renderChart(
  channel: ITradingViewNativeViewportSyncChannel | null,
  { fitRange = false, isMain = false } = {},
) {
  const redraw = jest.fn();
  const redrawRef = { current: redraw };
  const scope: { current: ITradingViewNativeMultiChartSyncScope } = {
    current: {
      isMain,
      instrumentKey: 'BTC',
      crosshair: null,
      interval: null,
      viewport: channel ? { channel, fitRange } : null,
    },
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TradingViewNativeMultiChartSyncContext.Provider value={scope.current}>
      {children}
    </TradingViewNativeMultiChartSyncContext.Provider>
  );
  const hook = renderHook(() => useChartViewportSync(redrawRef), { wrapper });
  redraw.mockClear();
  return {
    redraw,
    get: () => hook.result.current,
    setFitRange: (next: boolean) => {
      scope.current = {
        ...scope.current,
        viewport: channel && { channel, fitRange: next },
      };
      hook.rerender();
    },
    unmount: hook.unmount,
  };
}

describe('useChartViewportSync', () => {
  it('lines the charts up with the first panel until one is moved', () => {
    const channel = createTradingViewNativeViewportSyncChannel();
    const second = renderChart(channel);
    const first = renderChart(channel, { isMain: true });
    act(() => {
      second.get().publishViewport(viewport(50));
      first.get().publishViewport(viewport(100));
    });

    expect(first.get().getFollowedViewport()).toBeNull();
    expect(second.get().getFollowedViewport()).toEqual({
      viewport: viewport(100),
      fitRange: false,
    });
    expect(second.redraw).toHaveBeenCalledTimes(1);
  });

  it('follows the chart the user moved last', () => {
    const channel = createTradingViewNativeViewportSyncChannel();
    const first = renderChart(channel, { isMain: true });
    const second = renderChart(channel);
    act(() => {
      first.get().publishViewport(viewport(100));
      second.get().leadViewport();
      second.get().publishViewport(viewport(200));
    });

    expect(second.get().getFollowedViewport()).toBeNull();
    expect(first.get().getFollowedViewport()?.viewport).toEqual(viewport(200));
    expect(first.redraw).toHaveBeenCalledTimes(1);
  });

  it('matches the span of time only while the date range is synced', () => {
    const channel = createTradingViewNativeViewportSyncChannel();
    const first = renderChart(channel, { isMain: true });
    const second = renderChart(channel);
    act(() => first.get().publishViewport(viewport(100)));
    second.redraw.mockClear();
    second.setFitRange(true);

    expect(second.get().getFollowedViewport()?.fitRange).toBe(true);
    // Redrawn to take the new zoom, and still following the same chart.
    expect(second.redraw).toHaveBeenCalled();
    expect(second.get().getFollowedViewport()?.viewport).toEqual(viewport(100));
  });

  it('stops following a chart that is gone', () => {
    const channel = createTradingViewNativeViewportSyncChannel();
    const first = renderChart(channel, { isMain: true });
    const second = renderChart(channel);
    act(() => first.get().publishViewport(viewport(100)));
    first.unmount();

    expect(second.get().getFollowedViewport()).toBeNull();
  });

  it('keeps to itself outside a split view', () => {
    const chart = renderChart(null);
    act(() => {
      chart.get().leadViewport();
      chart.get().publishViewport(viewport(100));
    });
    expect(chart.get().getFollowedViewport()).toBeNull();
    expect(chart.redraw).not.toHaveBeenCalled();
  });
});
