import {
  getTradingViewNativeFullscreenButtonBottom,
  getTradingViewNativeFullscreenLayout,
  shouldHideTradingViewNativeStatusBar,
} from './fullscreenLayout';

describe('TradingView native fullscreen layout', () => {
  it('uses the current window bounds and matching safe-area insets', () => {
    const portraitLayout = getTradingViewNativeFullscreenLayout({
      height: 844,
      insets: { bottom: 34, left: 0, right: 0, top: 47 },
      width: 390,
    });
    const landscapeLayout = getTradingViewNativeFullscreenLayout({
      height: 390,
      insets: { bottom: 21, left: 47, right: 47, top: 0 },
      width: 844,
    });

    expect(portraitLayout).toEqual({
      contentHeight: 763,
      contentWidth: 390,
      fullscreenHeight: 844,
      fullscreenWidth: 390,
      insets: { bottom: 34, left: 0, right: 0, top: 47 },
    });
    expect(landscapeLayout).toEqual({
      contentHeight: 369,
      contentWidth: 750,
      fullscreenHeight: 390,
      fullscreenWidth: 844,
      insets: { bottom: 21, left: 47, right: 47, top: 0 },
    });
  });

  it('clamps invalid dimensions and safe-area values', () => {
    expect(
      getTradingViewNativeFullscreenLayout({
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

  it.each([
    {
      expected: true,
      height: 844,
      isAndroid: true,
      isFullscreen: true,
      isSpanningWindow: false,
      name: 'a compact portrait window',
      width: 390,
    },
    {
      expected: true,
      height: 390,
      isAndroid: true,
      isFullscreen: true,
      isSpanningWindow: false,
      name: 'a compact landscape window',
      width: 844,
    },
    {
      expected: false,
      height: 883,
      isAndroid: true,
      isFullscreen: true,
      isSpanningWindow: false,
      name: 'a large unfolded-sized window before posture detection is ready',
      width: 852,
    },
    {
      expected: false,
      height: 844,
      isAndroid: true,
      isFullscreen: true,
      isSpanningWindow: true,
      name: 'a spanning foldable window',
      width: 390,
    },
    {
      expected: false,
      height: 844,
      isAndroid: true,
      isFullscreen: false,
      isSpanningWindow: false,
      name: 'a non-fullscreen chart',
      width: 390,
    },
    {
      expected: false,
      height: 844,
      isAndroid: false,
      isFullscreen: true,
      isSpanningWindow: false,
      name: 'an iOS window',
      width: 390,
    },
  ])('returns $expected for $name', ({ expected, ...options }) => {
    expect(shouldHideTradingViewNativeStatusBar(options)).toBe(expected);
  });
});
