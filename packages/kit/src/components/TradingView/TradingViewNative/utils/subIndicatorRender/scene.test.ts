// cspell:ignore macd
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { TRADING_VIEW_NATIVE_PRICE_AXIS_MIN_TICK_SPACING } from '../../chartConstants';

import { getTradingViewNativeSubIndicatorPaneLayouts } from './layout';
import { createTradingViewNativeSubIndicatorRenderSnapshots } from './pipeline';
import {
  appendTradingViewNativeSubIndicatorCommands,
  appendTradingViewNativeSubIndicatorLegendCommands,
  getTradingViewNativeSubIndicatorCrosshairValueText,
} from './scene';

import type {
  ITradingViewNativeChartSceneCommand,
  ITradingViewNativeChartScenePaintStyle,
} from '../chartScene';

const POINTS: IMarketTokenKLineDataPoint[] = Array.from(
  { length: 80 },
  (_, index) => ({
    c: 100 + Math.sin(index / 3) * 8,
    h: 110 + Math.sin(index / 3) * 8,
    l: 90 + Math.sin(index / 3) * 8,
    o: 99 + Math.sin(index / 3) * 8,
    t: 1_700_000_000 + index * 60,
    v: 1000 + index * 10,
  }),
);

describe('TradingViewNative sub-indicator scene', () => {
  it('builds clipped RSI bands, fill, line, axis, and legend commands', () => {
    const [pane] = createTradingViewNativeSubIndicatorRenderSnapshots({
      configs: [{ id: 'rsi', indicator: 'RSI' }],
      points: POINTS,
    }).map(({ pane: renderPane }) => renderPane);
    const layouts = getTradingViewNativeSubIndicatorPaneLayouts({
      endIndex: POINTS.length,
      panes: pane ? [pane] : [],
      stackBottom: 300,
      stackTop: 244,
      startIndex: 20,
    });
    const commands: ITradingViewNativeChartSceneCommand[] = [];
    const customPaintStyles: Record<
      string,
      ITradingViewNativeChartScenePaintStyle
    > = {};

    appendTradingViewNativeSubIndicatorCommands({
      candleBodyWidth: 5,
      chartWidth: 280,
      commands,
      customPaintStyles,
      endIndex: POINTS.length,
      getPointX: (index) => index * 6,
      layouts,
      priceAxisX: 280,
      startIndex: 20,
    });
    const legendHitRegions = appendTradingViewNativeSubIndicatorLegendCommands({
      commands,
      layouts,
      measureTextWidth: (text) => text.length * 6,
      pointIndex: POINTS.length - 1,
      priceAxisX: 280,
    });

    expect(commands.filter((command) => command.kind === 'clip')).toHaveLength(
      commands.filter((command) => command.kind === 'restore').length,
    );
    expect(
      commands.some(
        (command) =>
          command.kind === 'rect' && command.customPaintId?.includes(':fill:'),
      ),
    ).toBe(true);
    expect(
      commands.some(
        (command) =>
          command.kind === 'polyline' &&
          command.customPaintId?.includes(':series:rsi'),
      ),
    ).toBe(true);
    expect(
      commands.some(
        (command) => command.kind === 'text' && command.text === 'RSI',
      ),
    ).toBe(true);
    expect(
      commands.flatMap((command) =>
        command.kind === 'text' && command.font === 'priceAxis'
          ? [command.text]
          : [],
      ),
    ).toEqual(['70.00', '50.00', '30.00']);
    const axisTickCommands = commands.filter(
      (command) => command.kind === 'line' && command.paint === 'gridLine',
    );
    expect(axisTickCommands).toHaveLength(3);
    expect(
      axisTickCommands.every(
        (command) =>
          command.kind === 'line' && command.x1 === 280 && command.x2 === 284,
      ),
    ).toBe(true);
    const legendBackgroundIndex = commands.findIndex(
      (command) =>
        command.kind === 'rect' && command.paint === 'legendBackground',
    );
    const legendTitleIndex = commands.findIndex(
      (command) => command.kind === 'text' && command.text === 'RSI',
    );
    expect(commands[legendBackgroundIndex]).toMatchObject({
      height: 15,
      kind: 'rect',
      paint: 'legendBackground',
      width: expect.any(Number),
      x: 4,
      y: 244,
    });
    expect(legendHitRegions[0]?.rect.height).toBe(24);
    expect(legendBackgroundIndex).toBeLessThan(legendTitleIndex);
    expect(Object.keys(customPaintStyles)).toEqual(
      expect.arrayContaining([
        expect.stringContaining(':band:upper'),
        expect.stringContaining(':fill:background'),
        expect.stringContaining(':series:rsi'),
      ]),
    );
  });

  it('avoids overlapping RSI reference labels in a narrow pane', () => {
    const [pane] = createTradingViewNativeSubIndicatorRenderSnapshots({
      configs: [{ id: 'rsi', indicator: 'RSI' }],
      points: POINTS,
    }).map(({ pane: renderPane }) => renderPane);
    const layouts = getTradingViewNativeSubIndicatorPaneLayouts({
      endIndex: POINTS.length,
      panes: pane ? [pane] : [],
      stackBottom: 300,
      stackTop: 265,
      startIndex: 20,
    });
    const commands: ITradingViewNativeChartSceneCommand[] = [];

    appendTradingViewNativeSubIndicatorCommands({
      candleBodyWidth: 5,
      chartWidth: 280,
      commands,
      customPaintStyles: {},
      endIndex: POINTS.length,
      getPointX: (index) => index * 6,
      layouts,
      priceAxisX: 280,
      startIndex: 20,
    });

    const axisLabelYValues = commands.flatMap((command) =>
      command.kind === 'text' && command.font === 'priceAxis'
        ? [command.y]
        : [],
    );
    expect(axisLabelYValues.length).toBeGreaterThan(0);
    expect(axisLabelYValues.length).toBeLessThan(3);
    for (let index = 1; index < axisLabelYValues.length; index += 1) {
      expect(
        (axisLabelYValues[index] ?? 0) - (axisLabelYValues[index - 1] ?? 0),
      ).toBeGreaterThanOrEqual(TRADING_VIEW_NATIVE_PRICE_AXIS_MIN_TICK_SPACING);
    }
  });

  it('uses MACD palette slots and a zero baseline for columns', () => {
    const [pane] = createTradingViewNativeSubIndicatorRenderSnapshots({
      configs: [{ id: 'macd', indicator: 'MACD' }],
      points: POINTS,
    }).map(({ pane: renderPane }) => renderPane);
    const layouts = getTradingViewNativeSubIndicatorPaneLayouts({
      endIndex: POINTS.length,
      panes: pane ? [pane] : [],
      stackBottom: 300,
      stackTop: 244,
      startIndex: 30,
    });
    const commands: ITradingViewNativeChartSceneCommand[] = [];
    const customPaintStyles: Record<
      string,
      ITradingViewNativeChartScenePaintStyle
    > = {};

    appendTradingViewNativeSubIndicatorCommands({
      candleBodyWidth: 5,
      chartWidth: 280,
      commands,
      customPaintStyles,
      endIndex: POINTS.length,
      getPointX: (index) => index * 6,
      layouts,
      priceAxisX: 280,
      startIndex: 30,
    });

    const histogramBars = commands.filter(
      (command) =>
        command.kind === 'rect' &&
        command.customPaintId?.includes(':series:histogram'),
    );
    expect(histogramBars.length).toBeGreaterThan(0);
    expect(
      histogramBars.some((command) =>
        command.kind === 'rect'
          ? command.customPaintId?.includes(':palette:')
          : false,
      ),
    ).toBe(true);
    expect(
      Object.keys(customPaintStyles).filter((key) => key.includes(':palette:')),
    ).toHaveLength(4);

    const histogram = pane?.series.find((series) => series.id === 'histogram');
    const pointIndex = POINTS.length - 1;
    const paletteIndex = histogram?.palette?.indexes[pointIndex];
    expect(typeof paletteIndex).toBe('number');
    appendTradingViewNativeSubIndicatorLegendCommands({
      commands,
      layouts,
      measureTextWidth: (text) => text.length * 6,
      pointIndex,
      priceAxisX: 280,
    });
    if (typeof paletteIndex === 'number' && histogram?.palette) {
      const palettePaintId = Object.keys(customPaintStyles).find((key) =>
        key.includes(`:series:histogram:palette:${paletteIndex}`),
      );
      const legendCommand = commands.find(
        (command) =>
          command.kind === 'text' &&
          command.text === 'Histogram' &&
          command.customPaintId === palettePaintId,
      );
      const legendPaint = palettePaintId
        ? customPaintStyles[palettePaintId]
        : undefined;
      expect(legendCommand).toBeDefined();
      expect(legendPaint?.color).toBe(histogram.palette.colors[paletteIndex]);
    }
  });

  it('formats the active pane crosshair value', () => {
    const [pane] = createTradingViewNativeSubIndicatorRenderSnapshots({
      configs: [{ id: 'rsi', indicator: 'RSI' }],
      points: POINTS,
    }).map(({ pane: renderPane }) => renderPane);
    const layouts = getTradingViewNativeSubIndicatorPaneLayouts({
      endIndex: POINTS.length,
      panes: pane ? [pane] : [],
      stackBottom: 300,
      stackTop: 244,
      startIndex: 20,
    });

    expect(
      getTradingViewNativeSubIndicatorCrosshairValueText({
        layouts,
        y: 272,
      }),
    ).toMatch(/^-?\d+\.\d{2}$/);
    expect(
      getTradingViewNativeSubIndicatorCrosshairValueText({
        layouts,
        y: 200,
      }),
    ).toBeNull();
  });

  it('supports plot fills across finite runs and narrow histogram bars', () => {
    const [pane] = createTradingViewNativeSubIndicatorRenderSnapshots({
      configs: [{ id: 'macd', indicator: 'MACD' }],
      points: POINTS,
    }).map(({ pane: renderPane }) => renderPane);
    expect(pane).toBeDefined();
    if (!pane) {
      return;
    }
    const histogram = pane.series.find((series) => series.id === 'histogram');
    const macd = pane.series.find((series) => series.id === 'macd');
    const signal = pane.series.find((series) => series.id === 'signal');
    expect(histogram && macd && signal).toBeTruthy();
    if (!histogram || !macd || !signal) {
      return;
    }
    histogram.style.type = 'histogram';
    histogram.style.lineWidth = 2;
    macd.values[55] = null;
    pane.fills.push({
      fromId: macd.id,
      id: 'macdSignalCloud',
      key: `${pane.key}:fill:macdSignalCloud`,
      style: { color: '#123456', transparency: 70, visible: true },
      title: 'MACD signal cloud',
      toId: signal.id,
      type: 'plot-plot',
      zOrder: 5,
    });
    const layouts = getTradingViewNativeSubIndicatorPaneLayouts({
      endIndex: POINTS.length,
      panes: [pane],
      stackBottom: 300,
      stackTop: 244,
      startIndex: 30,
    });
    const commands: ITradingViewNativeChartSceneCommand[] = [];

    appendTradingViewNativeSubIndicatorCommands({
      candleBodyWidth: 5,
      chartWidth: 280,
      commands,
      customPaintStyles: {},
      endIndex: POINTS.length,
      getPointX: (index) => index * 6,
      layouts,
      priceAxisX: 280,
      startIndex: 30,
    });

    expect(
      commands.filter(
        (command) =>
          command.kind === 'polygon' &&
          command.customPaintId?.includes(':fill:macdSignalCloud'),
      ).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      commands
        .filter(
          (command) =>
            command.kind === 'rect' &&
            command.customPaintId?.includes(':series:histogram'),
        )
        .every((command) => command.kind === 'rect' && command.width === 2),
    ).toBe(true);
  });

  it('segments palette-backed lines and colors their legend value', () => {
    const [pane] = createTradingViewNativeSubIndicatorRenderSnapshots({
      configs: [{ id: 'macd', indicator: 'MACD' }],
      points: POINTS,
    }).map(({ pane: renderPane }) => renderPane);
    const histogram = pane?.series.find((series) => series.id === 'histogram');
    expect(pane && histogram?.palette).toBeTruthy();
    if (!pane || !histogram?.palette) {
      return;
    }
    histogram.style.type = 'line';
    const layouts = getTradingViewNativeSubIndicatorPaneLayouts({
      endIndex: POINTS.length,
      panes: [pane],
      stackBottom: 300,
      stackTop: 244,
      startIndex: 30,
    });
    const commands: ITradingViewNativeChartSceneCommand[] = [];
    const customPaintStyles: Record<
      string,
      ITradingViewNativeChartScenePaintStyle
    > = {};
    const pointIndex = POINTS.length - 1;

    appendTradingViewNativeSubIndicatorCommands({
      candleBodyWidth: 5,
      chartWidth: 280,
      commands,
      customPaintStyles,
      endIndex: POINTS.length,
      getPointX: (index) => index * 6,
      layouts,
      priceAxisX: 280,
      startIndex: 30,
    });
    appendTradingViewNativeSubIndicatorLegendCommands({
      commands,
      layouts,
      measureTextWidth: (text) => text.length * 6,
      pointIndex,
      priceAxisX: 280,
    });

    expect(
      commands.some(
        (command) =>
          command.kind === 'polyline' &&
          command.customPaintId?.includes(':series:histogram:palette:'),
      ),
    ).toBe(true);
    const paletteIndex = histogram.palette.indexes[pointIndex];
    expect(typeof paletteIndex).toBe('number');
    if (typeof paletteIndex === 'number') {
      const legendPaintId = Object.keys(customPaintStyles).find((key) =>
        key.includes(`:series:histogram:palette:${paletteIndex}:legend`),
      );
      expect(
        commands.some(
          (command) =>
            command.kind === 'text' &&
            command.text === 'Histogram' &&
            command.customPaintId === legendPaintId,
        ),
      ).toBe(true);
      expect(
        legendPaintId ? customPaintStyles[legendPaintId]?.color : null,
      ).toBe(histogram.palette.colors[paletteIndex]);
    }
  });

  it('does not draw false one-pixel columns at the baseline', () => {
    const zeroVolumePoints = POINTS.map((point) => ({ ...point, v: 0 }));
    const [pane] = createTradingViewNativeSubIndicatorRenderSnapshots({
      configs: [{ id: 'volume', indicator: 'VOL' }],
      points: zeroVolumePoints,
    }).map(({ pane: renderPane }) => renderPane);
    const layouts = getTradingViewNativeSubIndicatorPaneLayouts({
      endIndex: zeroVolumePoints.length,
      panes: pane ? [pane] : [],
      stackBottom: 300,
      stackTop: 244,
      startIndex: 20,
    });
    const commands: ITradingViewNativeChartSceneCommand[] = [];

    appendTradingViewNativeSubIndicatorCommands({
      candleBodyWidth: 5,
      chartWidth: 280,
      commands,
      customPaintStyles: {},
      endIndex: zeroVolumePoints.length,
      getPointX: (index) => index * 6,
      layouts,
      priceAxisX: 280,
      startIndex: 20,
    });

    expect(
      commands.some(
        (command) =>
          command.kind === 'rect' &&
          command.customPaintId?.includes(':series:volume'),
      ),
    ).toBe(false);
  });

  it('suppresses axis labels and legends when a pane is too short', () => {
    const [pane] = createTradingViewNativeSubIndicatorRenderSnapshots({
      configs: [{ id: 'rsi', indicator: 'RSI' }],
      points: POINTS,
    }).map(({ pane: renderPane }) => renderPane);
    const layouts = getTradingViewNativeSubIndicatorPaneLayouts({
      endIndex: POINTS.length,
      panes: pane ? [pane] : [],
      stackBottom: 300,
      stackTop: 287,
      startIndex: 20,
    });
    const commands: ITradingViewNativeChartSceneCommand[] = [];
    const customPaintStyles: Record<
      string,
      ITradingViewNativeChartScenePaintStyle
    > = {};

    appendTradingViewNativeSubIndicatorCommands({
      candleBodyWidth: 5,
      chartWidth: 280,
      commands,
      customPaintStyles,
      endIndex: POINTS.length,
      getPointX: (index) => index * 6,
      layouts,
      priceAxisX: 280,
      startIndex: 20,
    });
    appendTradingViewNativeSubIndicatorLegendCommands({
      commands,
      layouts,
      measureTextWidth: (text) => text.length * 6,
      pointIndex: POINTS.length - 1,
      priceAxisX: 280,
    });

    expect(commands.some((command) => command.kind === 'text')).toBe(false);
  });

  it('does not draw a false fill when two configured bands overlap', () => {
    const [pane] = createTradingViewNativeSubIndicatorRenderSnapshots({
      configs: [
        {
          id: 'rsi',
          indicator: 'RSI',
          settings: {
            bands: { lower: { value: 50 }, upper: { value: 50 } },
          },
        },
      ],
      points: POINTS,
    }).map(({ pane: renderPane }) => renderPane);
    const layouts = getTradingViewNativeSubIndicatorPaneLayouts({
      endIndex: POINTS.length,
      panes: pane ? [pane] : [],
      stackBottom: 300,
      stackTop: 244,
      startIndex: 20,
    });
    const commands: ITradingViewNativeChartSceneCommand[] = [];

    appendTradingViewNativeSubIndicatorCommands({
      candleBodyWidth: 5,
      chartWidth: 280,
      commands,
      customPaintStyles: {},
      endIndex: POINTS.length,
      getPointX: (index) => index * 6,
      layouts,
      priceAxisX: 280,
      startIndex: 20,
    });

    expect(
      commands.some(
        (command) =>
          command.kind === 'rect' &&
          command.customPaintId?.includes(':fill:background'),
      ),
    ).toBe(false);
  });

  it('wraps all visible DMI values into multiple legend rows', () => {
    const [pane] = createTradingViewNativeSubIndicatorRenderSnapshots({
      configs: [{ id: 'dmi', indicator: 'DMI' }],
      points: POINTS,
    }).map(({ pane: renderPane }) => renderPane);
    const layouts = getTradingViewNativeSubIndicatorPaneLayouts({
      endIndex: POINTS.length,
      panes: pane ? [pane] : [],
      stackBottom: 300,
      stackTop: 244,
      startIndex: 20,
    });
    const commands: ITradingViewNativeChartSceneCommand[] = [];
    const pointIndex = POINTS.length - 1;

    appendTradingViewNativeSubIndicatorCommands({
      candleBodyWidth: 5,
      chartWidth: 190,
      commands,
      customPaintStyles: {},
      endIndex: POINTS.length,
      getPointX: (index) => index * 6,
      layouts,
      priceAxisX: 190,
      startIndex: 20,
    });
    appendTradingViewNativeSubIndicatorLegendCommands({
      commands,
      layouts,
      measureTextWidth: (text) => text.length * 6,
      pointIndex,
      priceAxisX: 190,
    });

    const legendCommands = commands.filter(
      (command) => command.kind === 'text' && command.font === 'legend',
    );
    const visibleSeries =
      pane?.series.filter((series) => {
        const value = series.values[pointIndex];
        return (
          series.style.visible &&
          value !== null &&
          value !== undefined &&
          Number.isFinite(value)
        );
      }) ?? [];
    for (const series of visibleSeries) {
      expect(
        legendCommands.some(
          (command) => command.kind === 'text' && command.text === series.title,
        ),
      ).toBe(true);
    }
    expect(
      new Set(
        legendCommands.flatMap((command) =>
          command.kind === 'text' ? [command.y] : [],
        ),
      ).size,
    ).toBeGreaterThan(1);
  });
});
