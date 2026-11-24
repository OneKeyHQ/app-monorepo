/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';

import { createTradingViewNativeIntervalSync } from './intervalSync';
import { TradingViewNativeMultiChartSyncContext } from './TradingViewNativeMultiChartSyncContext';
import { useMultiChartIntervalSync } from './useMultiChartIntervalSync';

import type { ITradingViewNativeIntervalSync } from './intervalSync';
import type { ITradingViewNativeMultiChartSyncScope } from './TradingViewNativeMultiChartSyncContext';

// A chart as the hook sees it: its interval and a way to change it.
function renderPanel(
  sync: ITradingViewNativeIntervalSync | null,
  {
    initialInterval,
    isMain = false,
    supports = () => true,
  }: {
    initialInterval: string;
    isMain?: boolean;
    supports?: (interval: string) => boolean;
  },
) {
  // What the chart tells the grid about its interval.
  const reportInterval = jest.fn<void, [string | undefined]>();
  const reportIntervalPick = jest.fn<void, [string]>();
  const scope: { current: ITradingViewNativeMultiChartSyncScope } = {
    current: {
      isMain,
      reportInterval,
      reportIntervalPick,
      instrumentKey: 'BTC',
      crosshair: null,
      interval: sync,
      viewport: null,
    },
  };
  const state = { interval: initialInterval };
  const onSyncedIntervalChange = jest.fn((interval: string) => {
    if (supports(interval)) state.interval = interval;
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TradingViewNativeMultiChartSyncContext.Provider value={scope.current}>
      {children}
    </TradingViewNativeMultiChartSyncContext.Provider>
  );
  const hook = renderHook(
    () =>
      useMultiChartIntervalSync({
        activeInterval: state.interval,
        onSyncedIntervalChange,
      }),
    { wrapper },
  );
  return {
    getInterval: () => state.interval,
    onSyncedIntervalChange,
    // The user picks an interval in this panel. As in the chart, the pick is
    // passed on before the panel has rendered with it.
    pick: (interval: string) =>
      act(() => {
        hook.result.current(interval);
        state.interval = interval;
        hook.rerender();
      }),
    setSync: (next: ITradingViewNativeIntervalSync | null) => {
      scope.current = { ...scope.current, interval: next };
      hook.rerender();
    },
    // The chart moves to another interval by itself, e.g. back to the one it
    // showed as the data of a new one fails to load.
    fallBack: (interval: string) =>
      act(() => {
        state.interval = interval;
        hook.rerender();
      }),
    reportInterval,
    reportIntervalPick,
    unmount: hook.unmount,
  };
}

describe('interval sync', () => {
  it('starts every panel from the interval of the first one', () => {
    const sync = createTradingViewNativeIntervalSync();
    // Mounted before the first panel, as an effect order may have it.
    const second = renderPanel(sync, { initialInterval: '15' });
    const first = renderPanel(sync, { initialInterval: '60', isMain: true });
    const third = renderPanel(sync, { initialInterval: '1D' });

    expect(first.getInterval()).toBe('60');
    expect(second.getInterval()).toBe('60');
    expect(third.getInterval()).toBe('60');
  });

  it('starts every panel, the first one too, from the interval syncing was turned on with', () => {
    const sync = createTradingViewNativeIntervalSync('240');
    const first = renderPanel(sync, { initialInterval: '60', isMain: true });
    const second = renderPanel(sync, { initialInterval: '15' });

    expect(sync.get()).toBe('240');
    expect(first.getInterval()).toBe('240');
    expect(second.getInterval()).toBe('240');
  });

  it('hands the first panel the interval already shared when its chart joins later', () => {
    const sync = createTradingViewNativeIntervalSync();
    const first = renderPanel(sync, { initialInterval: '60', isMain: true });
    const second = renderPanel(sync, { initialInterval: '15' });
    second.pick('240');
    // Its chart is mounted anew, e.g. for another token.
    first.unmount();
    const remounted = renderPanel(sync, {
      initialInterval: '60',
      isMain: true,
    });

    expect(sync.get()).toBe('240');
    expect(remounted.getInterval()).toBe('240');
    expect(second.getInterval()).toBe('240');
  });

  it('leaves a panel on the interval it fell back to by itself', () => {
    const sync = createTradingViewNativeIntervalSync();
    const first = renderPanel(sync, { initialInterval: '60', isMain: true });
    const second = renderPanel(sync, { initialInterval: '15' });
    first.pick('240');
    second.onSyncedIntervalChange.mockClear();
    second.fallBack('60');
    // Nothing replays the shared interval to it until the next pick.
    expect(second.onSyncedIntervalChange).not.toHaveBeenCalled();
    expect(second.getInterval()).toBe('60');
    expect(first.getInterval()).toBe('240');

    first.pick('5');
    expect(second.getInterval()).toBe('5');
  });

  it('tells the grid the interval its chart is on, synced or not', () => {
    const chart = renderPanel(null, { initialInterval: '60' });
    expect(chart.reportInterval).toHaveBeenLastCalledWith('60');
    chart.pick('15');
    expect(chart.reportInterval).toHaveBeenLastCalledWith('15');

    const sync = createTradingViewNativeIntervalSync('240');
    chart.setSync(sync);
    act(() => {});
    expect(chart.getInterval()).toBe('240');
    chart.setSync(sync);
    expect(chart.reportInterval).toHaveBeenLastCalledWith('240');

    chart.unmount();
    expect(chart.reportInterval).toHaveBeenLastCalledWith(undefined);
  });

  it('tells the grid the intervals picked in its chart, and no others', () => {
    const sync = createTradingViewNativeIntervalSync();
    const first = renderPanel(sync, { initialInterval: '60', isMain: true });
    const second = renderPanel(sync, { initialInterval: '15' });
    // Taken from the first panel, not picked.
    expect(second.reportIntervalPick).not.toHaveBeenCalled();
    first.pick('240');
    expect(first.reportIntervalPick).toHaveBeenLastCalledWith('240');
    second.fallBack('60');
    expect(second.reportIntervalPick).not.toHaveBeenCalled();

    // Also while nothing is synced: the grid may be waiting for the option.
    const alone = renderPanel(null, { initialInterval: '60' });
    alone.pick('5');
    expect(alone.reportIntervalPick).toHaveBeenLastCalledWith('5');
  });

  it('moves every panel to the interval picked in any of them', () => {
    const sync = createTradingViewNativeIntervalSync();
    const first = renderPanel(sync, { initialInterval: '60', isMain: true });
    const second = renderPanel(sync, { initialInterval: '15' });
    second.pick('240');

    expect(sync.get()).toBe('240');
    expect(first.getInterval()).toBe('240');
    expect(second.getInterval()).toBe('240');
  });

  it('does not hand a panel back the interval it just picked', () => {
    const sync = createTradingViewNativeIntervalSync();
    const first = renderPanel(sync, { initialInterval: '60', isMain: true });
    const second = renderPanel(sync, { initialInterval: '15' });
    second.onSyncedIntervalChange.mockClear();
    // A pick that comes with more to do, such as a calendar jump, must not be
    // replayed to the panel as if another one had made it.
    second.pick('240');

    expect(second.onSyncedIntervalChange).not.toHaveBeenCalled();
    expect(first.onSyncedIntervalChange).toHaveBeenCalledWith('240');
  });

  it('leaves a panel on its own interval when it cannot show the shared one', () => {
    const sync = createTradingViewNativeIntervalSync();
    const first = renderPanel(sync, { initialInterval: '60', isMain: true });
    const stock = renderPanel(sync, {
      initialInterval: '1D',
      supports: (interval) => interval !== '1',
    });
    expect(stock.getInterval()).toBe('60');

    first.pick('1');
    expect(stock.getInterval()).toBe('60');
    first.pick('240');
    expect(stock.getInterval()).toBe('240');
  });

  it('keeps the panels apart once syncing is off or the panel is gone', () => {
    const sync = createTradingViewNativeIntervalSync();
    const first = renderPanel(sync, { initialInterval: '60', isMain: true });
    const second = renderPanel(sync, { initialInterval: '15' });
    const third = renderPanel(sync, { initialInterval: '15' });
    second.setSync(null);
    third.unmount();
    first.pick('240');
    second.pick('5');

    expect(first.getInterval()).toBe('240');
    expect(second.getInterval()).toBe('5');
    expect(third.getInterval()).toBe('60');
  });

  it('does nothing for a chart outside a split view', () => {
    const chart = renderPanel(null, { initialInterval: '60' });
    chart.pick('15');
    expect(chart.getInterval()).toBe('15');
  });
});
