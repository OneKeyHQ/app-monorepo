import {
  isTradingViewNativeLogPriceScaleAvailable,
  mergeTradingViewNativePriceRanges,
  panTradingViewNativePriceRange,
} from './priceScale';

describe('TradingViewNative price ranges', () => {
  it('merges valid chart and indicator ranges', () => {
    expect(
      mergeTradingViewNativePriceRanges({
        additionalPriceRange: { maxPrice: 240, minPrice: 80 },
        priceRange: { maxPrice: 200, minPrice: 100 },
      }),
    ).toEqual({ maxPrice: 240, minPrice: 80 });
  });

  it('ignores invalid optional ranges', () => {
    expect(
      mergeTradingViewNativePriceRanges({
        additionalPriceRange: { maxPrice: Number.NaN, minPrice: 0 },
        priceRange: { maxPrice: 200, minPrice: 100 },
      }),
    ).toEqual({ maxPrice: 200, minPrice: 100 });
    expect(
      mergeTradingViewNativePriceRanges({
        additionalPriceRange: null,
        priceRange: null,
      }),
    ).toBeNull();
  });

  it('allows logarithmic mode only for an entirely positive range', () => {
    expect(
      isTradingViewNativeLogPriceScaleAvailable({
        maxPrice: 200,
        minPrice: 100,
      }),
    ).toBe(true);
    expect(
      isTradingViewNativeLogPriceScaleAvailable({
        maxPrice: 200,
        minPrice: 0,
      }),
    ).toBe(false);
    expect(isTradingViewNativeLogPriceScaleAvailable(null)).toBe(false);
  });
});

describe('price range panning', () => {
  it('moves a linear price range by the screen distance at the current scale', () => {
    expect(
      panTradingViewNativePriceRange({
        priceRange: { minPrice: 100, maxPrice: 200 },
        rangeScale: 2,
        mode: 'linear',
        chartHeight: 200,
        translationY: 50,
      }),
    ).toEqual({ minPrice: 150, maxPrice: 250 });
  });
  it('preserves ratios while panning a logarithmic scale', () => {
    const result = panTradingViewNativePriceRange({
      priceRange: { minPrice: 10, maxPrice: 100 },
      rangeScale: 1,
      mode: 'logarithmic',
      chartHeight: 200,
      translationY: -200,
    });
    expect(result.minPrice).toBeCloseTo(1);
    expect(result.maxPrice).toBeCloseTo(10);
  });
});
