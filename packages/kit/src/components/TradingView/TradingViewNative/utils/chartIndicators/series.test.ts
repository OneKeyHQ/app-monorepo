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
      'ma-5',
      'ma-10',
      'ma-20',
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
});
