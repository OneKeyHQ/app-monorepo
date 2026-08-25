import {
  applyTradingViewNativeSubIndicatorLatestPaneValues,
  getTradingViewNativeSubIndicatorPanesStructureKey,
  getTradingViewNativeSubIndicatorPanesUpdate,
  shouldReplaceTradingViewNativeIndicatorSeries,
} from './chartRuntimeData';

import type { ITradingViewNativeSubIndicatorRenderPane } from '../utils/subIndicatorRender';

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
  chartPictureVersion = 1,
  panes,
  pointCount = 3,
}: {
  chartPictureVersion?: number;
  panes: readonly ITradingViewNativeSubIndicatorRenderPane[];
  pointCount?: number;
}) {
  return {
    chartPictureVersion,
    pointCount,
    structureKey: getTradingViewNativeSubIndicatorPanesStructureKey(panes),
  };
}

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
    chartPictureVersion: 1,
    pointCount: 100,
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
