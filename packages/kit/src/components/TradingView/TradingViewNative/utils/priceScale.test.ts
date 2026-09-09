import {
  isTradingViewNativeLogPriceScaleAvailable,
  mergeTradingViewNativePriceRanges,
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
