import {
  getTradingViewNativePointerDragIntent,
  getTradingViewNativeTimeAxisPointerDragUpdate,
  shouldStartTradingViewNativeViewportPointerDrag,
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
    currentY: 50,
    isActive: false,
    startX: 100,
    startY: 50,
    startZoomScale: 1,
  };

  it('waits for horizontal movement beyond the drag threshold', () => {
    expect(
      getTradingViewNativeTimeAxisPointerDragUpdate({
        ...input,
        currentX: 104,
      }),
    ).toEqual({ type: 'pending' });
    expect(
      getTradingViewNativeTimeAxisPointerDragUpdate({
        ...input,
        currentX: 105,
      }),
    ).toMatchObject({ type: 'scale' });
  });

  it('cancels a vertical drag before horizontal scaling activates', () => {
    expect(
      getTradingViewNativeTimeAxisPointerDragUpdate({
        ...input,
        currentX: 103,
        currentY: 63,
      }),
    ).toEqual({ type: 'cancel' });
    expect(
      getTradingViewNativeTimeAxisPointerDragUpdate({
        ...input,
        currentX: 101,
        currentY: 100,
        isActive: true,
      }),
    ).toMatchObject({ type: 'scale' });
  });

  it('zooms in to the right and out to the left after activation', () => {
    const zoomIn = getTradingViewNativeTimeAxisPointerDragUpdate({
      ...input,
      currentX: 150,
      isActive: true,
    });
    const zoomOut = getTradingViewNativeTimeAxisPointerDragUpdate({
      ...input,
      currentX: 50,
      isActive: true,
    });

    expect(zoomIn.type).toBe('scale');
    expect(zoomOut.type).toBe('scale');
    if (zoomIn.type === 'scale' && zoomOut.type === 'scale') {
      expect(zoomIn.zoomScale).toBeGreaterThan(1);
      expect(zoomOut.zoomScale).toBeLessThan(1);
    }
  });
});

describe('TradingViewNative viewport pointer drag arbitration', () => {
  it('starts only a primary-button drag without an active peer drag', () => {
    expect(
      shouldStartTradingViewNativeViewportPointerDrag({
        button: 0,
        hasActiveDrag: false,
      }),
    ).toBe(true);
    expect(
      shouldStartTradingViewNativeViewportPointerDrag({
        button: 0,
        hasActiveDrag: true,
      }),
    ).toBe(false);
    expect(
      shouldStartTradingViewNativeViewportPointerDrag({
        button: 1,
        hasActiveDrag: false,
      }),
    ).toBe(false);
  });
});
