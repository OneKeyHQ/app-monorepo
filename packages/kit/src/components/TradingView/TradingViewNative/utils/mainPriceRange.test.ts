import { getTradingViewNativeMainPriceRange } from './mainPriceRange';

describe('TradingViewNative main price range', () => {
  it('combines candle and main-indicator values', () => {
    expect(
      getTradingViewNativeMainPriceRange({
        chartType: 'candlestick',
        endIndex: 1,
        indicatorSeries: [
          {
            indicator: 'MA',
            key: 'ma-5',
            kind: 'line',
            paint: 'indicatorCyanStroke',
            values: [240],
          },
        ],
        points: [{ c: 150, h: 200, l: 100, o: 120, t: 1, v: 10 }],
        startIndex: 0,
      }),
    ).toEqual({ maxPrice: 240, minPrice: 100 });
  });
});
