import { createTradingViewNativeChartSettings } from '@onekeyhq/shared/types/tradingViewNative';

import {
  createTradingViewNativeChartRuntime,
  resizeTradingViewNativeChartRuntime,
} from './chartRuntime';
import {
  applyTradingViewNativeSubIndicatorLatestPaneValues,
  getTradingViewNativeSubIndicatorPanesStructureKey,
  getTradingViewNativeSubIndicatorPanesUpdate,
  shouldReplaceTradingViewNativeChartPoints,
  shouldReplaceTradingViewNativeIndicatorSeries,
} from './chartRuntimeData';

import type { ITradingViewNativeSubIndicatorRenderPane } from '../utils/subIndicatorRender';

describe('TradingViewNativeChart resizing', () => {
  function createRuntime() {
    const runtime = createTradingViewNativeChartRuntime({
      candleIntervalSeconds: 60,
      chartComponents: [],
      chartSettings: createTradingViewNativeChartSettings(),
      chartType: 'candlestick',
      currentPriceLabel: '12',
      hasVolume: false,
      indicatorSeries: [
        {
          indicator: 'MA',
          key: 'ma',
          kind: 'line',
          paint: 'indicatorCyanStroke',
          values: Array.from({ length: 200 }, () => 12),
        },
      ],
      points: Array.from({ length: 200 }, (_, index) => ({
        c: 12,
        h: 15,
        l: 10,
        o: 11,
        t: index * 60,
        v: 1,
      })),
      subIndicatorPanes: [createPane()],
    });
    runtime.size = { width: 390, height: 320 };
    runtime.viewport = {
      initialRightOffsetResolved: true,
      offset: 100,
      zoomScale: 2,
    };
    runtime.panGesture.startOffset = 100;
    runtime.priceRangeScale = 1.5;
    return runtime;
  }

  it('preserves data, zoom and historical position through fullscreen and back', () => {
    const runtime = createRuntime();
    const landscape = resizeTradingViewNativeChartRuntime(
      runtime,
      { width: 760, height: 300 },
      60,
    );
    const portrait = resizeTradingViewNativeChartRuntime(
      landscape,
      runtime.size,
      60,
    );
    for (const resized of [landscape, portrait]) {
      expect(resized.points).toBe(runtime.points);
      expect(resized.indicatorSeries).toBe(runtime.indicatorSeries);
      expect(resized.indicatorSeries[0].values).toBe(
        runtime.indicatorSeries[0].values,
      );
      expect(resized.subIndicatorPanes).toBe(runtime.subIndicatorPanes);
      expect(resized.viewport).toEqual(runtime.viewport);
      expect(resized.priceRangeScale).toBe(1.5);
    }
    expect(landscape.size).toEqual({ width: 760, height: 300 });
    expect(portrait.size).toEqual(runtime.size);
  });

  it('ignores transient zero bounds and unchanged measurements', () => {
    const runtime = createRuntime();
    expect(
      resizeTradingViewNativeChartRuntime(runtime, { width: 0, height: 0 }, 60),
    ).toBe(runtime);
    expect(resizeTradingViewNativeChartRuntime(runtime, runtime.size, 60)).toBe(
      runtime,
    );
  });

  it('clamps the viewport and adjusts the gesture origin when a wider chart reaches the history boundary', () => {
    const runtime = createRuntime();
    runtime.viewport.offset = 10_000;
    runtime.panGesture.startOffset = 10_000;
    runtime.crosshair = { visible: true, x: 120, y: 200 };
    const resized = resizeTradingViewNativeChartRuntime(
      runtime,
      { width: 760, height: 300 },
      60,
    );
    expect(resized.viewport.offset).toBeLessThan(10_000);
    expect(resized.panGesture.startOffset).toBe(resized.viewport.offset);
    expect(resized.crosshair.visible).toBe(false);
    expect(runtime.crosshair.visible).toBe(true);
  });
});

function createPane({
  inputLength = 14,
  key = 'subIndicator.rsi.pane',
  latestPaletteIndex = 0,
  latestValue = 50,
  lineWidth = 1,
}: {
  inputLength?: number;
  key?: string;
  latestPaletteIndex?: number | null;
  latestValue?: number | null;
  lineWidth?: number;
} = {}): ITradingViewNativeSubIndicatorRenderPane {
  return {
    bands: [
      {
        id: 'middle',
        key: `${key}.band.middle`,
        style: {
          color: '#666666',
          lineStyle: 'dashed',
          lineWidth: 1,
          transparency: 20,
          value: 50,
          visible: true,
        },
        title: 'Middle',
        zOrder: 1,
      },
    ],
    fills: [],
    format: { precision: 2, type: 'inherit' },
    indicator: 'RSI',
    inputValues: { length: inputLength, source: 'close' },
    instanceId: 'rsi',
    isVisible: true,
    key,
    scale: { kind: 'fixed', maxValue: 100, minValue: 0 },
    series: [
      {
        id: 'rsi',
        key: `${key}.series.rsi`,
        palette: {
          colors: ['#00ff00', '#ff0000'],
          indexes: [null, 1, latestPaletteIndex],
        },
        style: {
          baseline: 0,
          color: '#7c3aed',
          joinPoints: false,
          lineStyle: 'solid',
          lineWidth,
          transparency: 0,
          type: 'line',
          visible: true,
        },
        title: 'RSI',
        values: [null, 45, latestValue],
        zOrder: 2,
      },
    ],
    shortTitle: 'RSI',
    title: 'Relative Strength Index',
  };
}

function createPictureInput({
  panes,
  pointCount = 3,
  renderDataRevision = '1:identity',
}: {
  panes: readonly ITradingViewNativeSubIndicatorRenderPane[];
  pointCount?: number;
  renderDataRevision?: string;
}) {
  return {
    pointCount,
    renderDataRevision,
    structureKey: getTradingViewNativeSubIndicatorPanesStructureKey(panes),
  };
}

describe('TradingViewNativeChart point-derived data updates', () => {
  const previous = {
    pointCount: 100,
    renderDataRevision: '1:identity',
  };

  it('keeps the constant-time latest-point path for unchanged data semantics', () => {
    expect(
      shouldReplaceTradingViewNativeChartPoints({
        current: previous,
        previous,
      }),
    ).toBe(false);
  });

  it('fully replaces points and indicators after a point transform change', () => {
    const current = {
      ...previous,
      renderDataRevision: '1:heikinAshi',
    };
    expect(
      shouldReplaceTradingViewNativeChartPoints({ current, previous }),
    ).toBe(true);
    expect(
      shouldReplaceTradingViewNativeIndicatorSeries({
        current: {
          ...current,
          seriesKey: 'ma-1',
          settingsKey: 'ma-settings',
        },
        previous: {
          ...previous,
          seriesKey: 'ma-1',
          settingsKey: 'ma-settings',
        },
      }),
    ).toBe(true);

    const panes = [createPane()];
    expect(
      getTradingViewNativeSubIndicatorPanesUpdate({
        current: createPictureInput({
          panes,
          renderDataRevision: current.renderDataRevision,
        }),
        panes,
        previous: createPictureInput({
          panes,
          renderDataRevision: previous.renderDataRevision,
        }),
      }).replacementPanes,
    ).toBe(panes);
  });
});

describe('TradingViewNativeChart sub-indicator realtime updates', () => {
  it('transfers and applies only latest values for an unchanged structure', () => {
    const runtimePanes = [
      createPane({ latestPaletteIndex: 0, latestValue: 50 }),
    ];
    const currentPanes = [
      createPane({ latestPaletteIndex: 1, latestValue: 51 }),
    ];
    const update = getTradingViewNativeSubIndicatorPanesUpdate({
      current: createPictureInput({ panes: currentPanes }),
      panes: currentPanes,
      previous: createPictureInput({ panes: runtimePanes }),
    });

    expect(update.replacementPanes).toBeNull();
    expect(update.latestPaneValues).toEqual([
      {
        key: 'subIndicator.rsi.pane',
        series: [
          {
            key: 'subIndicator.rsi.pane.series.rsi',
            paletteIndex: 1,
            value: 51,
          },
        ],
      },
    ]);

    const previousValues = runtimePanes[0].series[0].values;
    const previousPaletteIndexes = runtimePanes[0].series[0].palette?.indexes;
    const nextPanes = applyTradingViewNativeSubIndicatorLatestPaneValues({
      hasLatestPoint: true,
      latestPaneValues: update.latestPaneValues,
      panes: runtimePanes,
    });
    expect(nextPanes).toBe(runtimePanes);
    expect(nextPanes[0].series[0].values).toBe(previousValues);
    expect(nextPanes[0].series[0].palette?.indexes).toBe(
      previousPaletteIndexes,
    );
    expect(nextPanes[0].series[0].values).toEqual([null, 45, 51]);
    expect(nextPanes[0].series[0].palette?.indexes).toEqual([null, 1, 1]);
  });

  it('fully replaces panes after a style or input change', () => {
    const previousPanes = [createPane()];
    const previous = createPictureInput({ panes: previousPanes });
    const styleChangedPanes = [createPane({ lineWidth: 2 })];
    const inputChangedPanes = [createPane({ inputLength: 21 })];

    expect(
      getTradingViewNativeSubIndicatorPanesUpdate({
        current: createPictureInput({ panes: styleChangedPanes }),
        panes: styleChangedPanes,
        previous,
      }).replacementPanes,
    ).toBe(styleChangedPanes);
    expect(
      getTradingViewNativeSubIndicatorPanesUpdate({
        current: createPictureInput({ panes: inputChangedPanes }),
        panes: inputChangedPanes,
        previous,
      }).replacementPanes,
    ).toBe(inputChangedPanes);
  });

  it('keeps runtime panes unchanged when pane keys do not match', () => {
    const runtimePanes = [createPane()];
    const latestPaneValues = [
      {
        key: 'subIndicator.other.pane',
        series: [
          {
            key: 'subIndicator.other.pane.series.rsi',
            paletteIndex: 1,
            value: 60,
          },
        ],
      },
    ];

    expect(
      applyTradingViewNativeSubIndicatorLatestPaneValues({
        hasLatestPoint: true,
        latestPaneValues,
        panes: runtimePanes,
      }),
    ).toBe(runtimePanes);
    expect(runtimePanes[0].series[0].values).toEqual([null, 45, 50]);
  });
});

describe('TradingViewNativeChart main-indicator updates', () => {
  const previous = {
    pointCount: 100,
    renderDataRevision: '1:identity',
    seriesKey: 'ma-1|ma-2',
    settingsKey: '{"MA":{"period":5}}',
  };

  it('replaces the full series when indicator settings change', () => {
    expect(
      shouldReplaceTradingViewNativeIndicatorSeries({
        current: {
          ...previous,
          settingsKey: '{"MA":{"period":7}}',
        },
        previous,
      }),
    ).toBe(true);
  });

  it('keeps the realtime latest-value update when settings are unchanged', () => {
    expect(
      shouldReplaceTradingViewNativeIndicatorSeries({
        current: previous,
        previous,
      }),
    ).toBe(false);
  });
});
