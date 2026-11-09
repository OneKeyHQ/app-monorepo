import {
  isTransientLandscapePageLayout,
  shouldShowMobileNativeChart,
  shouldShowMobileSimpleChart,
} from './mobileChartVisibility';

describe('shouldShowMobileSimpleChart', () => {
  it('shows the simple line chart by default', () => {
    expect(
      shouldShowMobileSimpleChart({
        mode: 'simple',
        isChartFullscreen: false,
      }),
    ).toBe(true);
  });

  it('keeps the Pro chart while it is fullscreen', () => {
    expect(
      shouldShowMobileSimpleChart({
        mode: 'simple',
        isChartFullscreen: true,
      }),
    ).toBe(false);
    expect(
      shouldShowMobileSimpleChart({
        mode: 'pro',
        isChartFullscreen: false,
      }),
    ).toBe(false);
  });
});

describe('shouldShowMobileNativeChart', () => {
  it('follows the saved choice when TradingView can draw the page', () => {
    expect(
      shouldShowMobileNativeChart({
        isNativeChartPreferred: false,
        hasTradingViewParams: true,
        isSharePrice: false,
      }),
    ).toBe(false);
    expect(
      shouldShowMobileNativeChart({
        isNativeChartPreferred: true,
        hasTradingViewParams: true,
        isSharePrice: false,
      }),
    ).toBe(true);
  });

  it('shows the native chart until TradingView has chart params', () => {
    expect(
      shouldShowMobileNativeChart({
        isNativeChartPreferred: false,
        hasTradingViewParams: false,
        isSharePrice: false,
      }),
    ).toBe(true);
  });

  it('shows the native chart for a stock share price', () => {
    expect(
      shouldShowMobileNativeChart({
        isNativeChartPreferred: false,
        hasTradingViewParams: true,
        isSharePrice: true,
      }),
    ).toBe(true);
  });
});

describe('isTransientLandscapePageLayout', () => {
  const portraitWindow = { windowWidth: 360, windowHeight: 640 };
  const landscapeWindow = { windowWidth: 640, windowHeight: 360 };

  it('ignores a landscape page laid out under the fullscreen chart', () => {
    expect(
      isTransientLandscapePageLayout({
        keepsPortraitLayout: true,
        layoutWidth: 640,
        ...landscapeWindow,
      }),
    ).toBe(true);
    // A queued landscape layout can arrive once the window reports portrait.
    expect(
      isTransientLandscapePageLayout({
        keepsPortraitLayout: true,
        layoutWidth: 640,
        ...portraitWindow,
      }),
    ).toBe(true);
  });

  it('measures portrait layouts', () => {
    expect(
      isTransientLandscapePageLayout({
        keepsPortraitLayout: true,
        layoutWidth: 360,
        ...portraitWindow,
      }),
    ).toBe(false);
  });

  it('measures a phone window that is landscape on its own', () => {
    // E.g. split screen: no fullscreen rotation is under way.
    expect(
      isTransientLandscapePageLayout({
        keepsPortraitLayout: false,
        layoutWidth: 640,
        ...landscapeWindow,
      }),
    ).toBe(false);
  });

  it('measures every layout of a window that rotates freely', () => {
    expect(
      isTransientLandscapePageLayout({
        keepsPortraitLayout: false,
        layoutWidth: 1280,
        windowWidth: 1280,
        windowHeight: 800,
      }),
    ).toBe(false);
  });
});
