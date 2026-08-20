import {
  getTradingViewNativeFullscreenButtonBottom,
  getTradingViewNativeLandscapeFullscreenLayout,
} from './fullscreenLayout';

describe('TradingView native fullscreen layout', () => {
  it('uses the long screen edge as landscape width', () => {
    const portraitLayout = getTradingViewNativeLandscapeFullscreenLayout({
      height: 844,
      insets: { bottom: 21, left: 47, right: 47, top: 0 },
      width: 390,
    });
    const landscapeLayout = getTradingViewNativeLandscapeFullscreenLayout({
      height: 390,
      insets: { bottom: 21, left: 47, right: 47, top: 0 },
      width: 844,
    });

    expect(portraitLayout).toEqual(landscapeLayout);
    expect(portraitLayout).toEqual({
      contentHeight: 369,
      contentWidth: 750,
      fullscreenHeight: 390,
      fullscreenWidth: 844,
      insets: { bottom: 21, left: 47, right: 47, top: 0 },
    });
  });

  it('clamps invalid dimensions and safe-area values', () => {
    expect(
      getTradingViewNativeLandscapeFullscreenLayout({
        height: Number.NaN,
        insets: {
          bottom: -1,
          left: Number.POSITIVE_INFINITY,
          right: 10,
          top: 4,
        },
        width: 20,
      }),
    ).toEqual({
      contentHeight: 0,
      contentWidth: 10,
      fullscreenHeight: 0,
      fullscreenWidth: 20,
      insets: { bottom: 0, left: 0, right: 10, top: 4 },
    });
  });

  it('keeps the fullscreen button above the main pane time axis', () => {
    expect(
      getTradingViewNativeFullscreenButtonBottom({
        chartHeight: 300,
        paneCount: 0,
      }),
    ).toBe(32);
    expect(
      getTradingViewNativeFullscreenButtonBottom({
        chartHeight: 300,
        paneCount: 2,
      }),
    ).toBe(144);
  });
});
