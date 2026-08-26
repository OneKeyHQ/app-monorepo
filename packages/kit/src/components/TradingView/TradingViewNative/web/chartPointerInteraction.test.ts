import { getTradingViewNativePointerDragIntent } from './chartPointerInteraction';

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
