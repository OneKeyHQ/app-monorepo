import {
  buildTradingViewNativeSubIndicatorRenderPane,
  buildTradingViewNativeSubIndicatorRenderPanes,
} from './model';
import { resolveTradingViewNativeSubIndicatorInstance } from './settings';

import type { ITradingViewNativeSubIndicatorCalculation } from './types';

function createVolumeCalculation(): ITradingViewNativeSubIndicatorCalculation {
  return {
    indicator: 'VOL',
    inputValues: {
      colorBasedOnPreviousClose: false,
      movingAveragePeriod: 20,
      smoothingPeriod: 9,
    },
    paletteIndexes: {
      volume: [0, 1, 2, 0],
    },
    plots: {
      volume: [10, Number.NaN, Number.POSITIVE_INFINITY, 40],
    },
    pointCount: 3.8,
  };
}

function createRsiCalculation(): ITradingViewNativeSubIndicatorCalculation {
  return {
    indicator: 'RSI',
    inputValues: { movingAveragePeriod: 14, period: 14 },
    paletteIndexes: {},
    plots: {
      movingAverage: [null, 45],
      rsi: [40, 50],
    },
    pointCount: 2,
  };
}

describe('TradingViewNative sub-indicator render model', () => {
  it('maps definition order, resolved styles, and palettes to stable keys', () => {
    const instance = resolveTradingViewNativeSubIndicatorInstance({
      id: 'volume-primary',
      indicator: 'VOL',
      isVisible: false,
      settings: {
        palettes: { volume: ['#111111', '#222222'] },
        plots: {
          movingAverage: { color: '#ABCDEF', visible: true },
          volume: {
            baseline: -5,
            color: '#123456',
            transparency: 30,
          },
        },
      },
    });
    const calculation = createVolumeCalculation();

    const pane = buildTradingViewNativeSubIndicatorRenderPane({
      calculation,
      instance,
    });
    const rebuiltPane = buildTradingViewNativeSubIndicatorRenderPane({
      calculation,
      instance,
    });

    expect(pane.isVisible).toBe(false);
    expect(pane.key).toBe('subIndicator.volume-primary.pane');
    expect(pane.series.map(({ id }) => id)).toEqual([
      'volume',
      'movingAverage',
      'smoothedMovingAverage',
    ]);
    expect(pane.series.map(({ key }) => key)).toEqual([
      'subIndicator.volume-primary.plot.volume',
      'subIndicator.volume-primary.plot.movingAverage',
      'subIndicator.volume-primary.plot.smoothedMovingAverage',
    ]);
    expect(rebuiltPane.series.map(({ key }) => key)).toEqual(
      pane.series.map(({ key }) => key),
    );
    expect(pane.series[0]?.style).toMatchObject({
      baseline: -5,
      color: '#123456',
      transparency: 30,
    });
    expect(pane.series[1]?.style).toMatchObject({
      color: '#ABCDEF',
      visible: true,
    });
    expect(pane.series[0]?.palette).toEqual({
      colors: ['#111111', '#222222'],
      indexes: [0, 1, null],
    });
    expect(pane.series[1]?.palette).toBeUndefined();
    expect(pane.series[2]?.palette).toBeUndefined();
    expect(pane.inputValues).toEqual(calculation.inputValues);
    expect(pane.inputValues).not.toBe(calculation.inputValues);
  });

  it('pads, truncates, and sanitizes plot and palette data to pointCount', () => {
    const instance = resolveTradingViewNativeSubIndicatorInstance({
      id: 'volume-lengths',
      indicator: 'VOL',
    });
    const calculation = createVolumeCalculation();

    const pane = buildTradingViewNativeSubIndicatorRenderPane({
      calculation,
      instance,
    });

    expect(pane.series[0]?.values).toEqual([10, null, null]);
    expect(pane.series[0]?.palette?.indexes).toEqual([0, 1, null]);
    expect(pane.series[1]?.values).toEqual([null, null, null]);
    expect(pane.series[2]?.values).toEqual([null, null, null]);

    const emptyPane = buildTradingViewNativeSubIndicatorRenderPane({
      calculation: { ...calculation, pointCount: Number.NaN },
      instance,
    });
    expect(emptyPane.series[0]?.values).toEqual([]);
    expect(emptyPane.series[0]?.palette?.indexes).toEqual([]);
    expect(emptyPane.series[1]?.values).toEqual([]);
    expect(emptyPane.series[2]?.values).toEqual([]);
  });

  it('reuses canonical calculation arrays when their lengths match', () => {
    const instance = resolveTradingViewNativeSubIndicatorInstance({
      id: 'rsi-reuse',
      indicator: 'RSI',
    });
    const calculation = createRsiCalculation();

    const pane = buildTradingViewNativeSubIndicatorRenderPane({
      calculation,
      instance,
    });

    expect(pane.series[0]?.values).toBe(calculation.plots.rsi);
    expect(pane.series[1]?.values).toBe(calculation.plots.movingAverage);
  });

  it('keeps band, fill, and plot order from the registered definition', () => {
    const instance = resolveTradingViewNativeSubIndicatorInstance({
      id: 'rsi-order',
      indicator: 'RSI',
      settings: {
        bands: { upper: { color: '#FF0000', value: 75 } },
        fills: { background: { transparency: 50, visible: false } },
      },
    });
    const calculation = createRsiCalculation();

    const pane = buildTradingViewNativeSubIndicatorRenderPane({
      calculation,
      instance,
    });

    expect(pane.series.map(({ id }) => id)).toEqual(['rsi', 'movingAverage']);
    expect(pane.bands.map(({ id }) => id)).toEqual([
      'upper',
      'middle',
      'lower',
    ]);
    expect(pane.fills.map(({ id }) => id)).toEqual(['background']);
    expect(pane.bands.map(({ key }) => key)).toEqual([
      'subIndicator.rsi-order.band.upper',
      'subIndicator.rsi-order.band.middle',
      'subIndicator.rsi-order.band.lower',
    ]);
    expect(pane.fills[0]?.key).toBe('subIndicator.rsi-order.fill.background');
    expect(pane.bands[0]?.style).toMatchObject({
      color: '#FF0000',
      value: 75,
    });
    expect(pane.fills[0]?.style).toMatchObject({
      transparency: 50,
      visible: false,
    });
  });

  it('preserves instance order when building multiple panes', () => {
    const volumeInstance = resolveTradingViewNativeSubIndicatorInstance({
      id: 'volume-first',
      indicator: 'VOL',
    });
    const rsiInstance = resolveTradingViewNativeSubIndicatorInstance({
      id: 'rsi-second',
      indicator: 'RSI',
    });

    const panes = buildTradingViewNativeSubIndicatorRenderPanes([
      {
        calculation: createVolumeCalculation(),
        instance: volumeInstance,
      },
      { calculation: createRsiCalculation(), instance: rsiInstance },
    ]);

    expect(panes.map(({ instanceId }) => instanceId)).toEqual([
      'volume-first',
      'rsi-second',
    ]);
  });

  it('rejects calculations for a different indicator', () => {
    const instance = resolveTradingViewNativeSubIndicatorInstance({
      id: 'rsi-mismatch',
      indicator: 'RSI',
    });

    expect(() =>
      buildTradingViewNativeSubIndicatorRenderPane({
        calculation: createVolumeCalculation(),
        instance,
      }),
    ).toThrow('Cannot build RSI render pane from VOL calculation');
  });
});
