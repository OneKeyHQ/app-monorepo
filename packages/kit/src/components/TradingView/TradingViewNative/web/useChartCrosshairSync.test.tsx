/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';

import { createTradingViewNativeCrosshairSyncChannel } from '../multiChart/crosshairSync';
import { TradingViewNativeMultiChartSyncContext } from '../multiChart/TradingViewNativeMultiChartSyncContext';

import { useChartCrosshairSync } from './useChartCrosshairSync';

import type { ITradingViewNativeCrosshairSyncChannel } from '../multiChart/crosshairSync';
import type { ITradingViewNativeMultiChartSyncScope } from '../multiChart/TradingViewNativeMultiChartSyncContext';

function renderChart(
  channel: ITradingViewNativeCrosshairSyncChannel | null,
  instrumentKey: string,
) {
  const redraw = jest.fn();
  const redrawRef = { current: redraw };
  const scope: { current: ITradingViewNativeMultiChartSyncScope } = {
    current: {
      isMain: false,
      instrumentKey,
      crosshair: channel,
      interval: null,
      viewport: null,
    },
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TradingViewNativeMultiChartSyncContext.Provider value={scope.current}>
      {children}
    </TradingViewNativeMultiChartSyncContext.Provider>
  );
  const hook = renderHook(() => useChartCrosshairSync(redrawRef), { wrapper });
  const redrawsOnMount = redraw.mock.calls.length;
  redraw.mockClear();
  return {
    redraw,
    redrawsOnMount,
    get: () => hook.result.current,
    stopSyncing: () => {
      scope.current = { ...scope.current, crosshair: null };
      hook.rerender();
    },
    unmount: hook.unmount,
  };
}

describe('useChartCrosshairSync', () => {
  it('redraws the other charts with the shared time', () => {
    const channel = createTradingViewNativeCrosshairSyncChannel();
    const btc = renderChart(channel, 'BTC');
    const eth = renderChart(channel, 'ETH');
    act(() => btc.get().publishCrosshair({ time: 100, price: 5 }));

    expect(eth.redraw).toHaveBeenCalledTimes(1);
    expect(btc.redraw).not.toHaveBeenCalled();
    expect(btc.get().getSyncedCrosshair()).toBeNull();
    // Another instrument has its own prices: only the time carries over.
    expect(eth.get().getSyncedCrosshair()).toEqual({ time: 100, price: null });
  });

  it('carries the price over to a chart of the same instrument', () => {
    const channel = createTradingViewNativeCrosshairSyncChannel();
    const hourly = renderChart(channel, 'BTC');
    const daily = renderChart(channel, 'BTC');
    act(() => hourly.get().publishCrosshair({ time: 100, price: 5 }));

    expect(daily.get().getSyncedCrosshair()).toEqual({ time: 100, price: 5 });
  });

  it('draws a crosshair that was shared before the chart mounted', () => {
    const channel = createTradingViewNativeCrosshairSyncChannel();
    const btc = renderChart(channel, 'BTC');
    act(() => btc.get().publishCrosshair({ time: 100, price: 5 }));

    const eth = renderChart(channel, 'ETH');
    expect(eth.redrawsOnMount).toBe(1);
    expect(eth.get().getSyncedCrosshair()).toEqual({ time: 100, price: null });
  });

  it('clears the crosshair when its chart loses the pointer or unmounts', () => {
    const channel = createTradingViewNativeCrosshairSyncChannel();
    const btc = renderChart(channel, 'BTC');
    const eth = renderChart(channel, 'ETH');
    act(() => btc.get().publishCrosshair({ time: 100, price: 5 }));
    act(() => btc.get().publishCrosshair(null));
    expect(eth.get().getSyncedCrosshair()).toBeNull();
    expect(eth.redraw).toHaveBeenCalledTimes(2);

    act(() => btc.get().publishCrosshair({ time: 200, price: 5 }));
    btc.unmount();
    expect(eth.get().getSyncedCrosshair()).toBeNull();
    expect(eth.redraw).toHaveBeenCalledTimes(4);
  });

  it('stops following and sharing once syncing is turned off', () => {
    const channel = createTradingViewNativeCrosshairSyncChannel();
    const btc = renderChart(channel, 'BTC');
    const eth = renderChart(channel, 'ETH');
    const sol = renderChart(channel, 'SOL');
    act(() => btc.get().publishCrosshair({ time: 100, price: 5 }));
    eth.redraw.mockClear();
    eth.stopSyncing();
    // Redrawn once more, without the crosshair it was following.
    expect(eth.redraw).toHaveBeenCalledTimes(1);
    expect(eth.get().getSyncedCrosshair()).toBeNull();
    act(() => btc.get().publishCrosshair({ time: 200, price: 5 }));
    expect(eth.redraw).toHaveBeenCalledTimes(1);

    // A chart that stops syncing takes the crosshair it shared with it.
    btc.stopSyncing();
    expect(sol.get().getSyncedCrosshair()).toBeNull();
    act(() => btc.get().publishCrosshair({ time: 300, price: 5 }));
    expect(sol.get().getSyncedCrosshair()).toBeNull();
  });

  it('works as a single chart outside a split view', () => {
    const chart = renderChart(null, 'BTC');
    act(() => chart.get().publishCrosshair({ time: 100, price: 5 }));
    expect(chart.get().getSyncedCrosshair()).toBeNull();
    expect(chart.redraw).not.toHaveBeenCalled();
  });
});
