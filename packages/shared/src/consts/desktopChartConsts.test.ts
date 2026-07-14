import {
  DESKTOP_OFFLINE_CHART_ENTRY_URL,
  isAllowedDesktopChartNavigation,
} from './desktopChartConsts';

describe('isAllowedDesktopChartNavigation', () => {
  it('allows pages and assets on the packaged chart origin', () => {
    expect(
      isAllowedDesktopChartNavigation(DESKTOP_OFFLINE_CHART_ENTRY_URL),
    ).toBe(true);
    expect(
      isAllowedDesktopChartNavigation(
        'onekey-chart://local/assets/chart.js?version=1#runtime',
      ),
    ).toBe(true);
  });

  it.each([
    'https://example.com/',
    'onekey-chart://local.example.com/index.html',
    'onekey-chart://local:8080/index.html',
    'onekey-chart:///index.html',
    'not a url',
  ])('rejects navigation outside the packaged chart origin: %s', (url) => {
    expect(isAllowedDesktopChartNavigation(url)).toBe(false);
  });
});
