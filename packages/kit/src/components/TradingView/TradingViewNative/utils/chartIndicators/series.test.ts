import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { getTradingViewNativeIndicatorPriceRange } from './priceRange';
import { buildTradingViewNativeIndicatorSeries } from './series';

function buildPoints(
  closeValues: readonly number[],
): IMarketTokenKLineDataPoint[] {
  return closeValues.map((close, index) => ({
    c: close,
    h: close + 1,
    l: close - 1,
    o: close,
    t: 1_700_000_000 + index * 3600,
    v: 10,
  }));
}

describe('TradingViewNative indicator series', () => {
  it('builds only active series and includes them in the price range', () => {
    const points = buildPoints(Array.from({ length: 25 }, (_, index) => index));
    const series = buildTradingViewNativeIndicatorSeries({
      activeIndicatorValues: new Set(['MA', 'BOLL']),
      points,
    });

    expect(series.map((item) => item.key)).toEqual([
      'ma-1',
      'ma-2',
      'ma-3',
      'boll-middle',
      'boll-upper',
      'boll-lower',
    ]);
    expect(series.slice(0, 3).map((item) => item.legendLabel)).toEqual([
      'MA5',
      'MA10',
      'MA20',
    ]);
    expect(
      series
        .filter(({ indicator }) => indicator === 'BOLL')
        .map(({ style }) => style?.color),
    ).toEqual(['#F76B15', '#F76B15', '#F76B15']);
    expect(series.find(({ key }) => key === 'boll-upper')?.fill).toEqual({
      color: '$orange9',
      opacity: 0.1,
      toSeriesKey: 'boll-lower',
    });
    expect(series.every((item) => item.values.length === points.length)).toBe(
      true,
    );
    expect(
      getTradingViewNativeIndicatorPriceRange({
        endIndex: points.length,
        series,
        startIndex: 0,
      }),
    ).toEqual(
      expect.objectContaining({
        maxPrice: expect.any(Number),
        minPrice: expect.any(Number),
      }),
    );
  });

  it('uses stable slots and configured periods and paint styles', () => {
    const points = buildPoints([1, 2, 3]);
    const series = buildTradingViewNativeIndicatorSeries({
      activeIndicatorValues: new Set(['MA']),
      indicatorSettings: {
        MA: {
          active: true,
          id: 'MA',
          lines: {
            'line:0': {
              color: '#123456',
              enabled: true,
              period: 2,
              style: 'dashed',
            },
            'line:1': {
              color: '#E9386F',
              enabled: false,
              period: 10,
              style: 'solid',
            },
            'line:2': {
              color: '#23BFD5',
              enabled: false,
              period: 20,
              style: 'solid',
            },
          },
          parameters: {},
          transparency: 25,
        },
      },
      points,
    });

    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({
      key: 'ma-1',
      style: {
        color: '#123456',
        lineStyle: 'dashed',
        lineWidth: 1,
        opacity: 0.75,
      },
      values: [null, 1.5, 2.5],
    });
  });

  it('keeps BOLL fill boundaries when their strokes are hidden', () => {
    const points = buildPoints(Array.from({ length: 25 }, (_, index) => index));

    for (const hiddenBoundaryIds of [
      new Set(['upper']),
      new Set(['upper', 'lower']),
    ]) {
      const series = buildTradingViewNativeIndicatorSeries({
        activeIndicatorValues: new Set(['BOLL']),
        indicatorSettings: {
          BOLL: {
            active: true,
            id: 'BOLL',
            lines: {
              background: {
                color: '#FFAA00',
                enabled: true,
                period: 0,
                style: 'solid',
              },
              lower: {
                color: '#FFAA00',
                enabled: !hiddenBoundaryIds.has('lower'),
                period: 0,
                style: 'solid',
              },
              middle: {
                color: '#FFAA00',
                enabled: false,
                period: 0,
                style: 'solid',
              },
              upper: {
                color: '#FFAA00',
                enabled: !hiddenBoundaryIds.has('upper'),
                period: 0,
                style: 'solid',
              },
            },
            parameters: { deviation: 2, period: 20 },
            transparency: 0,
          },
        },
        points,
      });

      expect(series.map(({ key }) => key)).toEqual([
        'boll-upper',
        'boll-lower',
      ]);
      expect(series.find(({ key }) => key === 'boll-upper')?.fill).toEqual({
        color: '#FFAA00',
        opacity: 0.1,
        toSeriesKey: 'boll-lower',
      });
      expect(
        series
          .filter(({ key }) => hiddenBoundaryIds.has(key.replace('boll-', '')))
          .every(({ visible }) => visible === false),
      ).toBe(true);
    }
  });

  it('keeps configured main-indicator width and line pattern independent', () => {
    const series = buildTradingViewNativeIndicatorSeries({
      activeIndicatorValues: new Set(['MA']),
      indicatorSettings: {
        MA: {
          active: true,
          id: 'MA',
          lines: {
            'line:0': {
              color: '#123456',
              enabled: true,
              period: 2,
              secondaryStyle: 'dashed',
              style: 'bold',
            },
            'line:1': {
              color: '#E9386F',
              enabled: false,
              period: 10,
              style: 'solid',
            },
            'line:2': {
              color: '#23BFD5',
              enabled: false,
              period: 20,
              style: 'solid',
            },
          },
          parameters: {},
          transparency: 0,
        },
      },
      points: buildPoints([1, 2, 3]),
    });

    expect(series[0]?.style).toMatchObject({
      lineStyle: 'dashed',
      lineWidth: 3,
    });
  });

  it('splits SAR points into configured bullish and bearish colors', () => {
    const series = buildTradingViewNativeIndicatorSeries({
      activeIndicatorValues: new Set(['SAR']),
      indicatorSettings: {
        SAR: {
          active: true,
          id: 'SAR',
          lines: {},
          opacityColors: {
            downColor: '#AA0000',
            upColor: '#00AA00',
          },
          parameters: {},
          transparency: 0,
        },
      },
      points: [
        { c: 1, h: 2, l: 0, o: 1, t: 1, v: 1 },
        { c: 2, h: 3, l: 1, o: 1, t: 2, v: 1 },
        { c: 3, h: 4, l: 2, o: 2, t: 3, v: 1 },
        { c: 4, h: 5, l: 3, o: 3, t: 4, v: 1 },
        { c: 0, h: 4, l: -1, o: 4, t: 5, v: 1 },
      ],
    });

    expect(series.map(({ key }) => key)).toEqual(['sar-up', 'sar-down']);
    expect(series[0]).toMatchObject({
      style: { color: '#00AA00' },
      values: [null, 0, 0, 0.16, null],
    });
    expect(series[1]).toMatchObject({
      style: { color: '#AA0000' },
      values: [null, null, null, null, 5],
    });
  });

  it('builds the weighted moving averages with their own legend labels', () => {
    const points = buildPoints(Array.from({ length: 25 }, (_, index) => index));
    const series = buildTradingViewNativeIndicatorSeries({
      activeIndicatorValues: new Set(['WMA', 'VWMA']),
      points,
    });

    expect(series.map((item) => item.key)).toEqual([
      'wma-1',
      'wma-2',
      'wma-3',
      'vwma-1',
      'vwma-2',
      'vwma-3',
    ]);
    expect(series.map((item) => item.legendLabel)).toEqual([
      'WMA5',
      'WMA10',
      'WMA20',
      'VWMA5',
      'VWMA10',
      'VWMA20',
    ]);
    // Equal volumes make the volume weighted average a plain average.
    expect(series[3]?.values[24]).toBeCloseTo(22, 10);
    expect(series[0]?.values[24]).toBeCloseTo(22 + 2 / 3, 10);
  });

  it('builds SuperTrend, VWAP, Donchian and envelope overlays in registry order', () => {
    const points = buildPoints(
      Array.from({ length: 30 }, (_, index) => 100 + index * 2),
    );
    const series = buildTradingViewNativeIndicatorSeries({
      activeIndicatorValues: new Set(['DC', 'VWAP', 'ENV', 'SUPERTREND']),
      indicatorSettings: {
        ENV: {
          active: true,
          id: 'ENV',
          lines: {},
          parameters: { lookback: 5 },
          transparency: 0,
        },
      },
      points,
    });

    expect(series.map((item) => item.key)).toEqual([
      'supertrend-up',
      'supertrend-down',
      'env-upper',
      'env-lower',
      'vwap',
      'dc-basis',
      'dc-upper',
      'dc-lower',
    ]);
    expect(series.map((item) => item.legendLabel)).toEqual([
      'SUPERTREND',
      'SUPERTREND',
      'ENV UB',
      'ENV LB',
      'VWAP',
      'DC',
      'UB',
      'LB',
    ]);
    expect(series.find(({ key }) => key === 'env-upper')?.fill).toEqual({
      color: '$cyan9',
      opacity: 0.08,
      toSeriesKey: 'env-lower',
    });
    expect(series.find(({ key }) => key === 'dc-upper')?.fill).toEqual({
      color: '$orange9',
      opacity: 0.08,
      toSeriesKey: 'dc-lower',
    });
    // A steady rise is an uptrend, so only the lower band has values.
    expect(series[0]?.values[29]).toBeLessThan(points[29]?.c ?? 0);
    expect(series[1]?.values[29]).toBeNull();
    // Only SuperTrend can end up with a single value at a trend flip.
    expect(
      series.filter((item) => item.showIsolatedPoints).map((item) => item.key),
    ).toEqual(['supertrend-up', 'supertrend-down']);
    expect(series.every((item) => item.values.length === points.length)).toBe(
      true,
    );
  });

  it('keeps a hidden channel boundary only as an edge of the background', () => {
    const points = buildPoints(Array.from({ length: 25 }, (_, index) => index));
    const hiddenLine = {
      color: '#123456',
      enabled: false,
      period: 0,
      style: 'solid' as const,
    };
    const withBackground = buildTradingViewNativeIndicatorSeries({
      activeIndicatorValues: new Set(['DC']),
      indicatorSettings: {
        DC: {
          active: true,
          id: 'DC',
          lines: { basis: hiddenLine, upper: hiddenLine },
          parameters: {},
          transparency: 0,
        },
      },
      points,
    });
    const withoutBackground = buildTradingViewNativeIndicatorSeries({
      activeIndicatorValues: new Set(['DC']),
      indicatorSettings: {
        DC: {
          active: true,
          id: 'DC',
          lines: {
            background: hiddenLine,
            basis: hiddenLine,
            upper: hiddenLine,
          },
          parameters: {},
          transparency: 0,
        },
      },
      points,
    });

    expect(withBackground.map(({ key, visible }) => [key, visible])).toEqual([
      ['dc-upper', false],
      ['dc-lower', true],
    ]);
    expect(withoutBackground.map(({ key }) => key)).toEqual(['dc-lower']);
    expect(withoutBackground[0]?.fill).toBeUndefined();
  });
});
