import { createTradingViewNativeIndicatorSettings } from '@onekeyhq/shared/types/tradingViewNative';
import type {
  ITradingViewNativeMultiChartLayout,
  ITradingViewNativeSource,
} from '@onekeyhq/shared/types/tradingViewNative';

import {
  fillTradingViewNativeMultiChartPanels,
  getTradingViewNativeMultiChartDividers,
  getTradingViewNativeMultiChartPanelIds,
  getTradingViewNativeMultiChartRects,
  getTradingViewNativeMultiChartSizes,
  hasUnfilledTradingViewNativeMultiChartPanel,
  normalizeTradingViewNativeMultiChartLayout,
  resizeTradingViewNativeMultiChartTracks,
  updateTradingViewNativeMultiChartPanel,
} from './multiChartLayout';

const coin = (name: string): ITradingViewNativeSource => ({
  kind: 'hyperliquid',
  coin: name,
  environment: 'mainnet',
});
const indicatorSettings = createTradingViewNativeIndicatorSettings();
const equal = { columns: [0.5, 0.5], rows: [0.5, 0.5] };

describe('normalizeTradingViewNativeMultiChartLayout', () => {
  it('falls back to a single chart for missing or malformed snapshots', () => {
    for (const value of [undefined, null, 'x', [], { preset: '9' }]) {
      expect(normalizeTradingViewNativeMultiChartLayout(value)).toEqual({
        preset: '1',
        panels: {},
      });
    }
  });

  it('keeps valid panel state and drops what it cannot trust', () => {
    expect(
      normalizeTradingViewNativeMultiChartLayout({
        preset: '4',
        panels: {
          // The first panel always follows the host.
          main: { source: coin('BTC') },
          'panel-2': { source: coin('ETH'), indicatorSettings },
          'panel-3': { source: { kind: 'hyperliquid', coin: '' } },
          'panel-9': { source: coin('SOL') },
        },
        sizes: {
          '4': { columns: [3, 1], rows: [1, 1] },
          '2h': { columns: [1, 0], rows: [1] },
          '3': { columns: [1, 1], rows: [1] },
        },
      }),
    ).toEqual({
      preset: '4',
      panels: {
        'panel-2': { source: coin('ETH'), indicatorSettings },
        'panel-3': {},
      },
      sizes: { '4': { columns: [0.75, 0.25], rows: [0.5, 0.5] } },
    });
  });
});

describe('preset geometry', () => {
  it.each([
    ['1', 1],
    ['2h', 2],
    ['2v', 2],
    ['3', 3],
    ['4', 4],
  ] as const)('preset %s shows %i panels', (preset, count) => {
    const ids = getTradingViewNativeMultiChartPanelIds(preset);
    expect(ids).toHaveLength(count);
    expect(ids[0]).toBe('main');
  });

  it('gives the first panel the full height beside two stacked panels', () => {
    expect(getTradingViewNativeMultiChartRects('3', equal)).toEqual([
      { left: 0, top: 0, width: 0.5, height: 1 },
      { left: 0.5, top: 0, width: 0.5, height: 0.5 },
      { left: 0.5, top: 0.5, width: 0.5, height: 0.5 },
    ]);
  });

  it('stops a divider beside a panel that spans its boundary', () => {
    expect(getTradingViewNativeMultiChartDividers('3', equal)).toEqual([
      { axis: 'columns', index: 0, position: 0.5, start: 0, end: 1 },
      { axis: 'rows', index: 0, position: 0.5, start: 0.5, end: 1 },
    ]);
    expect(getTradingViewNativeMultiChartDividers('4', equal)).toEqual([
      { axis: 'columns', index: 0, position: 0.5, start: 0, end: 1 },
      { axis: 'rows', index: 0, position: 0.5, start: 0, end: 1 },
    ]);
    expect(
      getTradingViewNativeMultiChartDividers('1', { columns: [1], rows: [1] }),
    ).toEqual([]);
  });
});

describe('panel sizes', () => {
  const layout: ITradingViewNativeMultiChartLayout = {
    preset: '2h',
    panels: {},
    sizes: { '2h': { columns: [0.9, 0.1], rows: [1] } },
  };

  it('uses equal tracks until the user resizes a preset', () => {
    expect(
      getTradingViewNativeMultiChartSizes({
        layout: { preset: '4', panels: {}, sizes: layout.sizes },
      }),
    ).toEqual(equal);
  });

  it('keeps saved tracks above the minimum panel size once measured', () => {
    expect(getTradingViewNativeMultiChartSizes({ layout }).columns).toEqual([
      0.9, 0.1,
    ]);
    const { columns } = getTradingViewNativeMultiChartSizes({
      layout,
      availableSize: { width: 800, height: 400 },
    });
    expect(columns[1]).toBeCloseTo(240 / 800);
    expect(columns[0] + columns[1]).toBeCloseTo(1);
  });

  it('moves one divider between its two tracks only', () => {
    const tracks = resizeTradingViewNativeMultiChartTracks({
      tracks: [0.25, 0.25, 0.5],
      dividerIndex: 0,
      delta: 100,
      availableSize: 1000,
      minimumSize: 100,
    });
    expect(tracks[0]).toBeCloseTo(0.35);
    expect(tracks[1]).toBeCloseTo(0.15);
    expect(tracks[2]).toBe(0.5);
    // Clamped so neither neighbour goes below the minimum.
    expect(
      resizeTradingViewNativeMultiChartTracks({
        tracks: [0.5, 0.5],
        dividerIndex: 0,
        delta: 900,
        availableSize: 1000,
        minimumSize: 240,
      }),
    ).toEqual([0.76, 0.24]);
  });
});

describe('panel state', () => {
  const defaults = {
    mainSource: coin('BTC'),
    indicatorSettings,
    getDefaultPanelSource: ({
      usedSources,
    }: {
      usedSources: readonly ITradingViewNativeSource[];
    }) =>
      coin(
        ['BTC', 'ETH', 'SOL', 'HYPE'].find(
          (name) =>
            !usedSources.some(
              (source) => source.kind === 'hyperliquid' && source.coin === name,
            ),
        ) ?? 'BTC',
      ),
  };

  it('opens new panels on tokens that are not on screen yet', () => {
    const filled = fillTradingViewNativeMultiChartPanels(
      { preset: '4', panels: { 'panel-3': { source: coin('ETH') } } },
      defaults,
    );
    expect(filled.panels).toEqual({
      'panel-2': { source: coin('SOL'), indicatorSettings },
      'panel-3': { source: coin('ETH'), indicatorSettings },
      'panel-4': { source: coin('HYPE'), indicatorSettings },
    });
  });

  it('restores a panel the user had set up before', () => {
    const custom = { ...indicatorSettings, subIndicators: [] };
    const layout: ITradingViewNativeMultiChartLayout = {
      preset: '2h',
      panels: {
        'panel-2': { source: coin('DOGE'), indicatorSettings: custom },
      },
    };
    expect(fillTradingViewNativeMultiChartPanels(layout, defaults)).toBe(
      layout,
    );
  });

  it('gives a panel saved with only a token its own indicator settings', () => {
    const layout: ITradingViewNativeMultiChartLayout = {
      preset: '2h',
      panels: { 'panel-2': { source: coin('DOGE') } },
    };
    // Otherwise the panel would keep following the main chart's indicators.
    expect(hasUnfilledTradingViewNativeMultiChartPanel(layout)).toBe(true);
    const filled = fillTradingViewNativeMultiChartPanels(layout, defaults);
    expect(filled.panels).toEqual({
      'panel-2': { source: coin('DOGE'), indicatorSettings },
    });
    expect(hasUnfilledTradingViewNativeMultiChartPanel(filled)).toBe(false);
    // A panel the current preset does not show is not waited on.
    expect(
      hasUnfilledTradingViewNativeMultiChartPanel({ ...layout, preset: '1' }),
    ).toBe(false);
  });

  it('only updates the extra panels', () => {
    const layout: ITradingViewNativeMultiChartLayout = {
      preset: '2h',
      panels: { 'panel-2': { source: coin('ETH'), indicatorSettings } },
    };
    expect(
      updateTradingViewNativeMultiChartPanel(layout, 'panel-2', {
        source: coin('SOL'),
      }).panels['panel-2'],
    ).toEqual({ source: coin('SOL'), indicatorSettings });
    expect(
      updateTradingViewNativeMultiChartPanel(layout, 'main', {
        source: coin('SOL'),
      }),
    ).toBe(layout);
    expect(
      updateTradingViewNativeMultiChartPanel(layout, 'panel-9', {
        source: coin('SOL'),
      }),
    ).toBe(layout);
  });
});
