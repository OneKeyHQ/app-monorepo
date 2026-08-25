import {
  clampTradingViewNativePriceRangeScale,
  getTradingViewNativeMainPriceAxisLayout,
  getTradingViewNativePriceRangeScaleAfterDrag,
  isTradingViewNativeMainPriceAxisTouch,
  isTradingViewNativePriceAxisTouch,
} from './priceAxisScale';

describe('TradingViewNative price-axis scaling', () => {
  it('keeps the price axis inside the main chart when indicator panes are visible', () => {
    expect(
      getTradingViewNativeMainPriceAxisLayout({ height: 400, paneCount: 2 }),
    ).toEqual({
      bottomInset: 136,
      height: 264,
    });
    expect(
      getTradingViewNativeMainPriceAxisLayout({ height: 100, paneCount: 2 }),
    ).toEqual({
      bottomInset: 24,
      height: 76,
    });
  });

  it('clamps the price-range scale to safe bounds', () => {
    expect(clampTradingViewNativePriceRangeScale(Number.NaN)).toBe(1);
    expect(clampTradingViewNativePriceRangeScale(0.01)).toBe(0.1);
    expect(clampTradingViewNativePriceRangeScale(20)).toBe(10);
  });

  it('expands candles when dragging up and compresses them when dragging down', () => {
    const input = {
      chartHeight: 200,
      startScale: 1,
      startY: 100,
    };

    expect(
      getTradingViewNativePriceRangeScaleAfterDrag({
        ...input,
        currentY: 50,
      }),
    ).toBeLessThan(1);
    expect(
      getTradingViewNativePriceRangeScaleAfterDrag({
        ...input,
        currentY: 150,
      }),
    ).toBeGreaterThan(1);
  });

  it('only accepts touches inside the visible price axis', () => {
    const input = {
      priceAxisHeight: 220,
      priceAxisWidth: 44,
      width: 320,
    };

    expect(
      isTradingViewNativePriceAxisTouch({ ...input, x: 276, y: 100 }),
    ).toBe(true);
    expect(
      isTradingViewNativePriceAxisTouch({ ...input, x: 275, y: 100 }),
    ).toBe(false);
    expect(
      isTradingViewNativePriceAxisTouch({ ...input, x: 300, y: 220 }),
    ).toBe(false);
  });

  it('excludes sub-indicator axes from main price-axis gestures', () => {
    const input = {
      height: 400,
      paneCount: 2,
      priceAxisWidth: 44,
      width: 320,
      x: 300,
    };

    expect(isTradingViewNativeMainPriceAxisTouch({ ...input, y: 263 })).toBe(
      true,
    );
    expect(isTradingViewNativeMainPriceAxisTouch({ ...input, y: 264 })).toBe(
      false,
    );
    expect(isTradingViewNativeMainPriceAxisTouch({ ...input, y: 350 })).toBe(
      false,
    );
  });
});
