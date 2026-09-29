import { shouldShowMobileSimpleChart } from './mobileChartVisibility';

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
