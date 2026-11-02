import {
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
