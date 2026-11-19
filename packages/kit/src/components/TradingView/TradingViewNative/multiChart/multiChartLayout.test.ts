import { createTradingViewNativeIndicatorSettings } from '@onekeyhq/shared/types/tradingViewNative';
import type {
  ITradingViewNativeMultiChartLayout,
  ITradingViewNativeSource,
} from '@onekeyhq/shared/types/tradingViewNative';

import {
  fillTradingViewNativeMultiChartPanels,
  getTradingViewNativeMultiChartActivePanelId,
  getTradingViewNativeMultiChartDividers,
  getTradingViewNativeMultiChartPanelIds,
  getTradingViewNativeMultiChartRects,
  getTradingViewNativeMultiChartSizes,
  getTradingViewNativeMultiChartSync,
  hasUnfilledTradingViewNativeMultiChartPanel,
  normalizeTradingViewNativeMultiChartLayout,
  resizeTradingViewNativeMultiChartTracks,
  selectTradingViewNativeMultiChartPanel,
  setTradingViewNativeMultiChartSync,
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
        activePanelId: 'panel-3',
        panels: {
          // The first panel keeps the host's indicators; only its token stays.
          main: { source: coin('BTC'), indicatorSettings },
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
      activePanelId: 'panel-3',
      panels: {
        main: { source: coin('BTC') },
        'panel-2': { source: coin('ETH'), indicatorSettings },
        'panel-3': {},
      },
      sizes: { '4': { columns: [0.75, 0.25], rows: [0.5, 0.5] } },
    });
    expect(
      normalizeTradingViewNativeMultiChartLayout({
        preset: '2h',
        activePanelId: 'panel-9',
        panels: {},
      }),
    ).toEqual({ preset: '2h', panels: {} });
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
    activeSource: coin('BTC'),
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

  it('gives a first panel that is not selected a token, but no indicators', () => {
    const layout: ITradingViewNativeMultiChartLayout = {
      preset: '2h',
      activePanelId: 'panel-2',
      panels: { 'panel-2': { source: coin('ETH'), indicatorSettings } },
    };
    expect(hasUnfilledTradingViewNativeMultiChartPanel(layout)).toBe(true);
    // The selected panel shows BTC; the ETH it stores is not on screen.
    expect(
      fillTradingViewNativeMultiChartPanels(layout, defaults).panels,
    ).toEqual({
      main: { source: coin('ETH') },
      'panel-2': { source: coin('ETH'), indicatorSettings },
    });
    // A selected extra panel needs no token of its own.
    expect(
      hasUnfilledTradingViewNativeMultiChartPanel({
        preset: '2h',
        activePanelId: 'panel-2',
        panels: {
          main: { source: coin('SOL') },
          'panel-2': { indicatorSettings },
        },
      }),
    ).toBe(false);
  });

  it('only stores the token of the first panel', () => {
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
        indicatorSettings,
      }).panels.main,
    ).toEqual({ source: coin('SOL') });
    expect(
      updateTradingViewNativeMultiChartPanel(layout, 'main', {
        indicatorSettings,
      }),
    ).toBe(layout);
    expect(
      updateTradingViewNativeMultiChartPanel(layout, 'panel-9', {
        source: coin('SOL'),
      }),
    ).toBe(layout);
  });
});

describe('sync options', () => {
  const layout: ITradingViewNativeMultiChartLayout = {
    preset: '2h',
    panels: { 'panel-2': { source: coin('ETH'), indicatorSettings } },
  };

  it('shares nothing until the user turns an option on', () => {
    expect(getTradingViewNativeMultiChartSync(layout)).toEqual({
      symbol: false,
      interval: false,
      crosshair: false,
      time: false,
      dateRange: false,
    });
  });

  it('saves a choice only when it changes something', () => {
    const on = setTradingViewNativeMultiChartSync(
      setTradingViewNativeMultiChartSync(layout, 'crosshair', true),
      'interval',
      true,
    );
    expect(on).toEqual({
      ...layout,
      sync: { crosshair: true, interval: true },
    });
    const next = setTradingViewNativeMultiChartSync(on, 'crosshair', false);
    expect(getTradingViewNativeMultiChartSync(next)).toEqual({
      symbol: false,
      interval: true,
      crosshair: false,
      time: false,
      dateRange: false,
    });
    expect(setTradingViewNativeMultiChartSync(layout, 'crosshair', false)).toBe(
      layout,
    );
    expect(setTradingViewNativeMultiChartSync(next, 'interval', true)).toBe(
      next,
    );
  });

  it('survives the changes that rebuild the layout', () => {
    const synced = setTradingViewNativeMultiChartSync(
      layout,
      'dateRange',
      true,
    );
    const saved = normalizeTradingViewNativeMultiChartLayout(
      JSON.parse(JSON.stringify(synced)),
    );
    expect(saved).toEqual(synced);
    expect(
      updateTradingViewNativeMultiChartPanel(saved, 'panel-2', {
        source: coin('SOL'),
      }).sync,
    ).toEqual({ dateRange: true });
    expect(
      selectTradingViewNativeMultiChartPanel(saved, 'panel-2', {
        main: coin('BTC'),
      }).sync,
    ).toEqual({ dateRange: true });
  });

  it('falls back to the defaults for values it cannot trust', () => {
    for (const sync of [null, 'off', [], { crosshair: 'no', zoom: true }, {}]) {
      expect(
        normalizeTradingViewNativeMultiChartLayout({ ...layout, sync }),
      ).toEqual(layout);
    }
    expect(
      normalizeTradingViewNativeMultiChartLayout({
        ...layout,
        sync: { symbol: true, time: 1, crosshair: false },
      }).sync,
    ).toEqual({ symbol: true, crosshair: false });
  });
});

describe('panel selection', () => {
  const layout: ITradingViewNativeMultiChartLayout = {
    preset: '4',
    panels: {
      'panel-2': { source: coin('ETH'), indicatorSettings },
      'panel-3': { source: coin('SOL'), indicatorSettings },
    },
  };

  it('starts on the first panel and falls back to it while hidden', () => {
    expect(getTradingViewNativeMultiChartActivePanelId(layout)).toBe('main');
    const selected = { ...layout, activePanelId: 'panel-3' };
    expect(getTradingViewNativeMultiChartActivePanelId(selected)).toBe(
      'panel-3',
    );
    expect(
      getTradingViewNativeMultiChartActivePanelId({
        ...selected,
        preset: '2h',
      }),
    ).toBe('main');
    // The selection returns with a preset that shows the panel again.
    expect(
      getTradingViewNativeMultiChartActivePanelId({ ...selected, preset: '3' }),
    ).toBe('panel-3');
  });

  it('leaves every chart on its token', () => {
    const selected = selectTradingViewNativeMultiChartPanel(layout, 'panel-2', {
      main: coin('BTC'),
    });
    // The first panel goes on showing the token it showed as the trading chart.
    expect(selected).toEqual({
      ...layout,
      activePanelId: 'panel-2',
      panels: { ...layout.panels, main: { source: coin('BTC') } },
    });
    // Selecting the first panel again hands panel-2 the traded token, DOGE.
    expect(
      selectTradingViewNativeMultiChartPanel(selected, 'main', {
        'panel-2': coin('DOGE'),
      }),
    ).toEqual({
      ...selected,
      activePanelId: 'main',
      panels: {
        ...selected.panels,
        'panel-2': { source: coin('DOGE'), indicatorSettings },
      },
    });
  });

  it('lands complete on a snapshot that missed an earlier selection', () => {
    // A split runtime evaluates a write against the last snapshot it received:
    // panel-2 was selected first, and that write has not come back yet.
    const second = selectTradingViewNativeMultiChartPanel(layout, 'panel-3', {
      main: coin('BTC'),
      'panel-2': coin('ETH'),
    });
    expect(second).toEqual({
      ...layout,
      activePanelId: 'panel-3',
      panels: { ...layout.panels, main: { source: coin('BTC') } },
    });
    // The same write changes nothing once the layout has it all.
    expect(
      selectTradingViewNativeMultiChartPanel(second, 'panel-3', {
        main: coin('BTC'),
        'panel-2': coin('ETH'),
      }),
    ).toBe(second);
  });

  it('keeps every stored token while all panels show the host token', () => {
    expect(selectTradingViewNativeMultiChartPanel(layout, 'panel-3')).toEqual({
      ...layout,
      activePanelId: 'panel-3',
    });
  });

  it('ignores the selected panel and panels the preset hides', () => {
    expect(selectTradingViewNativeMultiChartPanel(layout, 'main')).toBe(layout);
    const twoPanels = { ...layout, preset: '2h' as const };
    expect(
      selectTradingViewNativeMultiChartPanel(twoPanels, 'panel-3', {
        main: coin('BTC'),
      }),
    ).toBe(twoPanels);
  });
});
