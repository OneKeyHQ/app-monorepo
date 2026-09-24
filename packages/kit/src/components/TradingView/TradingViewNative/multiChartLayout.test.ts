import type { IMarketTradingViewLayout } from '@onekeyhq/kit-bg/src/states/jotai/atoms/market';
import {
  createTradingViewNativeChartSettings,
  createTradingViewNativeIndicatorSettings,
} from '@onekeyhq/shared/types/tradingViewNative';

import {
  closeTradingViewPanel,
  getTradingViewPanelSizes,
  moveTradingViewPanel,
  resizeTradingViewMultiChartLayout,
  resizeTradingViewPanelSizes,
} from './multiChartLayout';

const defaults = {
  chartSettings: createTradingViewNativeChartSettings(),
  indicatorSettings: createTradingViewNativeIndicatorSettings(),
};

function createLayout(): IMarketTradingViewLayout {
  return {
    panelCount: 1,
    panelOrder: ['main', 'panel-2', 'panel-3', 'panel-4'],
    panelSettings: {},
  };
}

describe('TradingView panel identities', () => {
  it('seeds new panels once and retains their settings after collapsing the layout', () => {
    const expanded = resizeTradingViewMultiChartLayout(
      createLayout(),
      4,
      defaults,
    );
    const customized = {
      ...expanded,
      panelSettings: {
        ...expanded.panelSettings,
        'panel-2': {
          ...defaults,
          chartSettings: {
            ...defaults.chartSettings,
            chartType: 'line' as const,
          },
        },
      },
    };
    const restored = resizeTradingViewMultiChartLayout(
      resizeTradingViewMultiChartLayout(customized, 1, defaults),
      4,
      defaults,
    );
    expect(restored.panelSettings['panel-2'].chartSettings.chartType).toBe(
      'line',
    );
    expect(restored.panelSettings['panel-3'].chartSettings).toBe(
      defaults.chartSettings,
    );
    expect(restored.panelOrder).toEqual(expanded.panelOrder);
  });

  it('moves and closes panel identities without reassigning their settings', () => {
    const expanded = resizeTradingViewMultiChartLayout(
      createLayout(),
      4,
      defaults,
    );
    const moved = moveTradingViewPanel(expanded, 'panel-2', -1);
    const closed = closeTradingViewPanel(moved, 'main');
    expect(closed.panelCount).toBe(3);
    expect(closed.panelOrder).toEqual([
      'panel-2',
      'panel-3',
      'panel-4',
      'main',
    ]);
    expect(closed.panelSettings).toBe(expanded.panelSettings);
    const restored = resizeTradingViewMultiChartLayout(closed, 4, defaults);
    expect(restored.panelOrder).toEqual(closed.panelOrder);
    expect(restored.panelSettings['panel-2']).toBe(
      expanded.panelSettings['panel-2'],
    );
  });

  it('keeps at least one panel and does not move a hidden panel into the visible layout', () => {
    const layout = createLayout();
    expect(closeTradingViewPanel(layout, 'main')).toBe(layout);
    expect(moveTradingViewPanel(layout, 'main', -1)).toBe(layout);
    expect(moveTradingViewPanel(layout, 'panel-3', -1)).toBe(layout);
  });
});

describe('TradingView panel resize constraints', () => {
  it('limits dragging to the adjacent panels while preserving the other rows', () => {
    const sizes = resizeTradingViewPanelSizes({
      sizes: [0.25, 0.25, 0.25, 0.25],
      dividerIndex: 1,
      delta: 1000,
      availableSize: 1200,
      minimumSize: 140,
    });
    expect(sizes[0]).toBe(0.25);
    expect(sizes[3]).toBe(0.25);
    expect(sizes[2] * 1200).toBeCloseTo(140);
    expect(sizes.reduce((total, size) => total + size, 0)).toBeCloseTo(1);
  });

  it('restores each layout proportions without applying a different layout shape', () => {
    expect(
      getTradingViewPanelSizes({ columns: [0.3, 0.7], rows: [0.6, 0.4] }, 2, 2),
    ).toEqual({
      columns: [0.3, 0.7],
      rows: [0.6, 0.4],
    });
    expect(
      getTradingViewPanelSizes({ columns: [0.3, 0.7], rows: [0.6, 0.4] }, 1, 4),
    ).toEqual({
      columns: [1],
      rows: [0.25, 0.25, 0.25, 0.25],
    });
  });
});
