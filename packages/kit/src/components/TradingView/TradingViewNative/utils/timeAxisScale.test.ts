import {
  getTradingViewNativeTimeAxisZoomScaleAfterDrag,
  isTradingViewNativeTimeAxisTouch,
} from './timeAxisScale';

describe('TradingViewNative time-axis scaling', () => {
  it('zooms in when dragging right and zooms out when dragging left', () => {
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
    ).toBeGreaterThan(1);
    expect(
      getTradingViewNativeTimeAxisZoomScaleAfterDrag({
        ...input,
        currentX: 50,
      }),
    ).toBeLessThan(1);
  });

  it('clamps time-axis dragging to the supported zoom range', () => {
    expect(
      getTradingViewNativeTimeAxisZoomScaleAfterDrag({
        chartWidth: 200,
        currentX: 1000,
        startX: 190,
        startZoomScale: 3,
      }),
    ).toBe(3);
    expect(
      getTradingViewNativeTimeAxisZoomScaleAfterDrag({
        chartWidth: 200,
        currentX: -10_000,
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
  });
});
