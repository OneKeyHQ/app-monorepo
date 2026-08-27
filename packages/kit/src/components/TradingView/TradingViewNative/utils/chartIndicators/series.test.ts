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
});
