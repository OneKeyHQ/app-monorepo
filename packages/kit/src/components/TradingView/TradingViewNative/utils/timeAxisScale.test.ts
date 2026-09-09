import {
  getTradingViewNativeTimeAxisZoomScaleAfterDrag,
  isTradingViewNativeTimeAxisTouch,
} from './timeAxisScale';

describe('TradingViewNative time-axis scaling', () => {
  it('compresses the time axis when dragging right and expands it when dragging left', () => {
    const input = {
      chartWidth: 200,
      startX: 100,
      startZoomScale: 1,
    };

    expect(
      getTradingViewNativeTimeAxisZoomScaleAfterDrag({
        ...input,
        currentX: 150,
      }),
    ).toBeLessThan(1);
    expect(
      getTradingViewNativeTimeAxisZoomScaleAfterDrag({
        ...input,
        currentX: 50,
      }),
    ).toBeGreaterThan(1);
  });

  it('uses drag distance consistently regardless of the starting position', () => {
    const dragFromLeft = getTradingViewNativeTimeAxisZoomScaleAfterDrag({
      chartWidth: 200,
      currentX: 70,
      startX: 20,
      startZoomScale: 1,
    });
    const dragFromRight = getTradingViewNativeTimeAxisZoomScaleAfterDrag({
      chartWidth: 200,
      currentX: 230,
      startX: 180,
      startZoomScale: 1,
    });

    expect(dragFromRight).toBeCloseTo(dragFromLeft);
    expect(dragFromRight).toBeLessThan(1);
  });

  it('compresses the time axis when dragging right from the chart boundary', () => {
    expect(
      getTradingViewNativeTimeAxisZoomScaleAfterDrag({
        chartWidth: 200,
        currentX: 205,
        startX: 200,
        startZoomScale: 1,
      }),
    ).toBeLessThan(1);
  });

  it('keeps the starting scale before an out-of-bounds drag moves', () => {
    expect(
      getTradingViewNativeTimeAxisZoomScaleAfterDrag({
        chartWidth: 200,
        currentX: 205,
        startX: 205,
        startZoomScale: 1,
      }),
    ).toBe(1);
  });

  it('clamps time-axis dragging to the supported zoom range', () => {
    expect(
      getTradingViewNativeTimeAxisZoomScaleAfterDrag({
        chartWidth: 200,
        currentX: -10_000,
        startX: 190,
        startZoomScale: 3,
      }),
    ).toBe(3);
    expect(
      getTradingViewNativeTimeAxisZoomScaleAfterDrag({
        chartWidth: 200,
        currentX: 10_000,
        startX: 10,
        startZoomScale: 0.2,
      }),
    ).toBe(0.2);
  });

  it('keeps the normalized starting scale for invalid coordinates', () => {
    expect(
      getTradingViewNativeTimeAxisZoomScaleAfterDrag({
        chartWidth: 0,
        currentX: 150,
        startX: 100,
        startZoomScale: 2,
      }),
    ).toBe(2);
    expect(
      getTradingViewNativeTimeAxisZoomScaleAfterDrag({
        chartWidth: 200,
        currentX: Number.NaN,
        startX: 100,
        startZoomScale: Number.NaN,
      }),
    ).toBe(1);
  });

  it('only accepts touches inside the visible time axis', () => {
    const input = {
      height: 300,
      priceAxisWidth: 44,
      width: 320,
    };

    expect(isTradingViewNativeTimeAxisTouch({ ...input, x: 275, y: 276 })).toBe(
      true,
    );
    expect(isTradingViewNativeTimeAxisTouch({ ...input, x: 276, y: 276 })).toBe(
      false,
    );
    expect(isTradingViewNativeTimeAxisTouch({ ...input, x: 100, y: 275 })).toBe(
      false,
    );
    expect(isTradingViewNativeTimeAxisTouch({ ...input, x: 100, y: 300 })).toBe(
      true,
    );
    expect(
      isTradingViewNativeTimeAxisTouch({
        ...input,
        timeAxisHeight: 20,
        x: 100,
        y: 279,
      }),
    ).toBe(false);
    expect(
      isTradingViewNativeTimeAxisTouch({
        ...input,
        timeAxisHeight: 20,
        x: 100,
        y: 280,
      }),
    ).toBe(true);
  });
});
