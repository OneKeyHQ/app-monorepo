import { isProviderApiPrivateAllowedMethod } from './backgroundApiPermissions';

describe('backgroundApiPermissions', () => {
  test('allows tradingview_touchScroll private method', () => {
    expect(isProviderApiPrivateAllowedMethod('tradingview_touchScroll')).toBe(
      true,
    );
  });
});
