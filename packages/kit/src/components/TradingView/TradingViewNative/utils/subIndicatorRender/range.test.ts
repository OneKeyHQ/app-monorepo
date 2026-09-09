import { getTradingViewNativeSubIndicatorValueRange } from './range';

import type {
  ITradingViewNativeSubIndicatorFillDefinition,
  ITradingViewNativeSubIndicatorPlotType,
  ITradingViewNativeSubIndicatorRenderBand,
  ITradingViewNativeSubIndicatorRenderFill,
  ITradingViewNativeSubIndicatorRenderPane,
  ITradingViewNativeSubIndicatorRenderSeries,
  ITradingViewNativeSubIndicatorScale,
} from './types';

function createSeries({
  baseline = 0,
  id,
  type = 'line',
  values,
  visible = true,
}: {
  baseline?: number;
  id: string;
  type?: ITradingViewNativeSubIndicatorPlotType;
  values: Array<number | null>;
  visible?: boolean;
}): ITradingViewNativeSubIndicatorRenderSeries {
  return {
    id,
    key: `test.plot.${id}`,
    style: {
      baseline,
      color: '#2196F3',
      joinPoints: false,
      lineStyle: 'solid',
      lineWidth: 1,
      transparency: 0,
      type,
      visible,
    },
    title: id,
    values,
    zOrder: 10,
  };
}

function createBand({
  id,
  value,
  visible = true,
}: {
  id: string;
  value: number;
  visible?: boolean;
}): ITradingViewNativeSubIndicatorRenderBand {
  return {
    id,
    key: `test.band.${id}`,
    style: {
      color: '#787B86',
      lineStyle: 'dashed',
      lineWidth: 1,
      transparency: 0,
      value,
      visible,
    },
    title: id,
    zOrder: -10,
  };
}

function createFill({
  fromId,
  id,
  toId,
  type,
  visible = true,
}: {
  fromId: string;
  id: string;
  toId: string;
  type: ITradingViewNativeSubIndicatorFillDefinition['type'];
  visible?: boolean;
}): ITradingViewNativeSubIndicatorRenderFill {
  return {
    fromId,
    id,
    key: `test.fill.${id}`,
    style: {
      color: '#7E57C2',
      transparency: 90,
      visible,
    },
    title: id,
    toId,
    type,
    zOrder: -20,
  };
}

function createPane({
  bands = [],
  fills = [],
  isVisible = true,
  scale = {
    includeValues: [],
    kind: 'auto',
    padding: { bottomRatio: 0, topRatio: 0 },
  },
  series = [],
}: {
  bands?: ITradingViewNativeSubIndicatorRenderBand[];
  fills?: ITradingViewNativeSubIndicatorRenderFill[];
  isVisible?: boolean;
  scale?: ITradingViewNativeSubIndicatorScale;
  series?: ITradingViewNativeSubIndicatorRenderSeries[];
} = {}): ITradingViewNativeSubIndicatorRenderPane {
  return {
    bands,
    fills,
    format: { precision: 2, type: 'price' },
    indicator: 'RSI',
    inputValues: {},
    instanceId: 'range-test',
    isVisible,
    key: 'subIndicator.range-test.pane',
    scale,
    series,
    shortTitle: 'RSI',
    title: 'Relative Strength Index',
  };
}

function getRange(
  pane: ITradingViewNativeSubIndicatorRenderPane,
  startIndex = 0,
  endIndex = Number.MAX_SAFE_INTEGER,
) {
  return getTradingViewNativeSubIndicatorValueRange({
    endIndex,
    pane,
    startIndex,
  });
}

describe('TradingViewNative sub-indicator value range', () => {
  it('returns a valid fixed range unless the pane is hidden', () => {
    const fixedScale: ITradingViewNativeSubIndicatorScale = {
      kind: 'fixed',
      maxValue: 100,
      minValue: -100,
    };

    expect(getRange(createPane({ scale: fixedScale }))).toEqual({
      maxValue: 100,
      minValue: -100,
    });
    expect(
      getRange(createPane({ isVisible: false, scale: fixedScale })),
    ).toBeNull();
    expect(
      getRange(
        createPane({
          scale: { kind: 'fixed', maxValue: 0, minValue: 10 },
        }),
      ),
    ).toBeNull();
  });

  it('uses visible series values from the half-open visible interval', () => {
    const pane = createPane({
      scale: {
        includeValues: [],
        kind: 'auto',
        padding: { bottomRatio: 0.25, topRatio: 0.5 },
      },
      series: [
        createSeries({
          id: 'visible',
          values: [-100, 2, Number.NaN, 10, 100],
        }),
        createSeries({
          id: 'hidden',
          values: [-1000, 1000],
          visible: false,
        }),
      ],
    });

    expect(getRange(pane, 1, 4)).toEqual({
      maxValue: 14,
      minValue: 0,
    });
  });

  it.each(['columns', 'histogram'] as const)(
    'includes the baseline for a visible %s series',
    (type) => {
      const pane = createPane({
        series: [createSeries({ baseline: -3, id: type, type, values: [5] })],
      });

      expect(getRange(pane, 0, 1)).toEqual({
        maxValue: 5,
        minValue: -3,
      });
    },
  );

  it('includes visible bands and endpoints required by visible fills', () => {
    const pane = createPane({
      bands: [
        createBand({ id: 'shown', value: 50 }),
        createBand({ id: 'band-low', value: -20, visible: false }),
        createBand({ id: 'band-high', value: 80, visible: false }),
        createBand({ id: 'ignored-band', value: -1000, visible: false }),
      ],
      fills: [
        createFill({
          fromId: 'plot-low',
          id: 'plot-fill',
          toId: 'plot-high',
          type: 'plot-plot',
        }),
        createFill({
          fromId: 'band-low',
          id: 'band-fill',
          toId: 'band-high',
          type: 'band-band',
        }),
        createFill({
          fromId: 'ignored-plot-low',
          id: 'hidden-fill',
          toId: 'ignored-plot-high',
          type: 'plot-plot',
          visible: false,
        }),
      ],
      series: [
        createSeries({ id: 'plot-low', values: [10], visible: false }),
        createSeries({ id: 'plot-high', values: [40], visible: false }),
        createSeries({
          id: 'ignored-plot-low',
          values: [-2000],
          visible: false,
        }),
        createSeries({
          id: 'ignored-plot-high',
          values: [2000],
          visible: false,
        }),
      ],
    });

    expect(getRange(pane, 0, 1)).toEqual({
      maxValue: 80,
      minValue: -20,
    });
  });

  it('applies includeValues and scale padding without plot data', () => {
    const pane = createPane({
      scale: {
        includeValues: [-1, 1],
        kind: 'auto',
        padding: { bottomRatio: 0.1, topRatio: 0.2 },
      },
    });

    const range = getRange(pane);
    expect(range?.minValue).toBeCloseTo(-1.2);
    expect(range?.maxValue).toBeCloseTo(1.4);
  });

  it('returns null when no finite visible values can contribute', () => {
    const pane = createPane({
      bands: [createBand({ id: 'hidden-band', value: 10, visible: false })],
      series: [
        createSeries({
          id: 'empty',
          values: [null, Number.NaN, Number.POSITIVE_INFINITY],
        }),
      ],
    });

    expect(getRange(pane, 0, 3)).toBeNull();
    expect(getRange(createPane())).toBeNull();
  });
});
