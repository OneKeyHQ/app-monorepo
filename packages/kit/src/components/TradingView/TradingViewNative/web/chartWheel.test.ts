import {
  TradingViewNativeWheelDeltaNormalizer,
  getTradingViewNativeWheelPanOffsetDelta,
  getTradingViewNativeWheelPriceRangeScale,
  getTradingViewNativeWheelZoomAnchorX,
  getTradingViewNativeWheelZoomScale,
} from './chartWheel';

describe('TradingViewNative chart wheel', () => {
  it('normalizes pixel, line, and page wheel deltas', () => {
    expect(
      new TradingViewNativeWheelDeltaNormalizer().processWheel({
        deltaMode: 0,
        deltaX: 50,
        deltaY: -100,
        isMacOS: false,
        shiftKey: false,
        timeStamp: 1,
      }),
    ).toEqual({ deltaX: 0.5, deltaY: -1 });
    expect(
      new TradingViewNativeWheelDeltaNormalizer().processWheel({
        deltaMode: 1,
        deltaX: 0,
        deltaY: 3,
        isMacOS: false,
        shiftKey: false,
        timeStamp: 1,
      }),
    ).toEqual({ deltaX: 0, deltaY: 0.96 });
    expect(
      new TradingViewNativeWheelDeltaNormalizer().processWheel({
        deltaMode: 2,
        deltaX: 0,
        deltaY: 1,
        isMacOS: false,
        shiftKey: false,
        timeStamp: 1,
      }),
    ).toEqual({ deltaX: 0, deltaY: 1.2 });
  });

  it('maps Shift plus a vertical wheel to horizontal scrolling off macOS', () => {
    expect(
      new TradingViewNativeWheelDeltaNormalizer().processWheel({
        deltaMode: 0,
        deltaX: 0,
        deltaY: 100,
        isMacOS: false,
        shiftKey: true,
        timeStamp: 1,
      }),
    ).toEqual({ deltaX: -1, deltaY: 0 });
  });

  it('uses the horizontal delta supplied by macOS for Shift scrolling', () => {
    expect(
      new TradingViewNativeWheelDeltaNormalizer().processWheel({
        deltaMode: 0,
        deltaX: -100,
        deltaY: 0,
        isMacOS: true,
        shiftKey: true,
        timeStamp: 1,
      }),
    ).toEqual({ deltaX: -1, deltaY: 0 });
  });

  it('filters minor movement on the non-dominant trackpad axis', () => {
    const normalizer = new TradingViewNativeWheelDeltaNormalizer();

    expect(
      normalizer.processWheel({
        deltaMode: 0,
        deltaX: 100,
        deltaY: 10,
        isMacOS: false,
        shiftKey: false,
        timeStamp: 1,
      }),
    ).toEqual({ deltaX: 1, deltaY: 0 });
    expect(
      normalizer.processWheel({
        deltaMode: 0,
        deltaX: 10,
        deltaY: 100,
        isMacOS: false,
        shiftKey: false,
        timeStamp: 102,
      }),
    ).toEqual({ deltaX: 0, deltaY: 1 });
  });

  it('matches TradingView wheel pan distance and capped zoom steps', () => {
    expect(getTradingViewNativeWheelPanOffsetDelta(-1)).toBe(80);
    expect(
      getTradingViewNativeWheelZoomScale({
        currentZoomScale: 2,
        deltaY: -1,
      }),
    ).toBe(2.2);
    expect(
      getTradingViewNativeWheelZoomScale({
        currentZoomScale: 2,
        deltaY: 5,
      }),
    ).toBe(1.8);
    expect(
      getTradingViewNativeWheelZoomScale({
        currentZoomScale: 2,
        deltaY: -0.25,
      }),
    ).toBe(2.05);
  });

  it('scales the price range when the wheel is over the price axis', () => {
    expect(
      getTradingViewNativeWheelPriceRangeScale({
        currentScale: 2,
        deltaY: -1,
      }),
    ).toBe(1.8);
    expect(
      getTradingViewNativeWheelPriceRangeScale({
        currentScale: 2,
        deltaY: 1,
      }),
    ).toBe(2.2);
    expect(
      getTradingViewNativeWheelPriceRangeScale({
        currentScale: 10,
        deltaY: 1,
      }),
    ).toBe(10);
  });

  it('uses the platform modifier only for focused zoom', () => {
    const commonOptions = {
      chartWidth: 300,
      cursorX: 120,
    };

    expect(
      getTradingViewNativeWheelZoomAnchorX({
        ...commonOptions,
        ctrlKey: false,
        isMacOS: false,
        metaKey: false,
      }),
    ).toBe(300);
    expect(
      getTradingViewNativeWheelZoomAnchorX({
        ...commonOptions,
        ctrlKey: true,
        isMacOS: false,
        metaKey: false,
      }),
    ).toBe(120);
    expect(
      getTradingViewNativeWheelZoomAnchorX({
        ...commonOptions,
        ctrlKey: true,
        isMacOS: true,
        metaKey: false,
      }),
    ).toBe(300);
    expect(
      getTradingViewNativeWheelZoomAnchorX({
        ...commonOptions,
        ctrlKey: false,
        isMacOS: true,
        metaKey: true,
      }),
    ).toBe(120);
  });
});
