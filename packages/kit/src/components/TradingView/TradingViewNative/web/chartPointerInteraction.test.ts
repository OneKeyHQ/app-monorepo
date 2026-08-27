import {
  getTradingViewNativePointerDragIntent,
  getTradingViewNativeTimeAxisPointerZoomScale,
} from './chartPointerInteraction';

describe('TradingViewNative pointer drag intent', () => {
  it('keeps small legend movement pending without starting a pan', () => {
    expect(
      getTradingViewNativePointerDragIntent({
        clientX: 15,
        clientY: 14,
        hasSubIndicatorSettingsTarget: true,
        startClientX: 10,
        startClientY: 10,
      }),
    ).toBe('pendingLegendTap');
  });

  it('switches the interaction to pan after the tap tolerance is exceeded', () => {
    expect(
      getTradingViewNativePointerDragIntent({
        clientX: 19,
        clientY: 10,
        hasSubIndicatorSettingsTarget: true,
        startClientX: 10,
        startClientY: 10,
      }),
    ).toBe('pan');
  });

  it('starts panning immediately outside a legend target', () => {
    expect(
      getTradingViewNativePointerDragIntent({
        clientX: 11,
        clientY: 10,
        hasSubIndicatorSettingsTarget: false,
        startClientX: 10,
        startClientY: 10,
      }),
    ).toBe('pan');
  });
});

describe('TradingViewNative time-axis pointer scaling', () => {
  const input = {
    chartWidth: 200,
    isActive: false,
    startX: 100,
    startZoomScale: 1,
  };

  it('waits for horizontal movement beyond the drag threshold', () => {
    expect(
      getTradingViewNativeTimeAxisPointerZoomScale({
        ...input,
        currentX: 104,
      }),
    ).toBeNull();
    expect(
      getTradingViewNativeTimeAxisPointerZoomScale({
        ...input,
        currentX: 105,
      }),
    ).not.toBeNull();
  });

  it('zooms in to the right and out to the left after activation', () => {
    expect(
      getTradingViewNativeTimeAxisPointerZoomScale({
        ...input,
        currentX: 150,
        isActive: true,
      }),
    ).toBeGreaterThan(1);
    expect(
      getTradingViewNativeTimeAxisPointerZoomScale({
        ...input,
        currentX: 50,
        isActive: true,
      }),
    ).toBeLessThan(1);
  });
});
