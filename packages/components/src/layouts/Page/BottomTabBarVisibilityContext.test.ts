import { getPageFooterBottomMetrics } from './BottomTabBarVisibilityContext';

describe('getPageFooterBottomMetrics', () => {
  it('assigns the safe area to the footer outside a tab navigator', () => {
    expect(
      getPageFooterBottomMetrics({
        bottom: 34,
        isNative: true,
        nativeTabBarHeight: undefined,
        tabBarVisible: undefined,
      }),
    ).toEqual({
      footerSafeAreaBottom: 34,
      tabBarHeight: 0,
    });
  });

  it('assigns the safe area to a visible tab bar', () => {
    expect(
      getPageFooterBottomMetrics({
        bottom: 34,
        isNative: true,
        nativeTabBarHeight: 83,
        tabBarVisible: true,
      }),
    ).toEqual({
      footerSafeAreaBottom: 0,
      tabBarHeight: 83,
    });
  });

  it('assigns the Android three-button inset to the footer when the tab bar is hidden', () => {
    expect(
      getPageFooterBottomMetrics({
        bottom: 48,
        isNative: true,
        nativeTabBarHeight: 0,
        tabBarVisible: false,
      }),
    ).toEqual({
      footerSafeAreaBottom: 48,
      tabBarHeight: 0,
    });
  });

  it('ignores a stale iOS tab bar height when the tab bar is hidden', () => {
    expect(
      getPageFooterBottomMetrics({
        bottom: 34,
        isNative: true,
        nativeTabBarHeight: 83,
        tabBarVisible: false,
      }),
    ).toEqual({
      footerSafeAreaBottom: 34,
      tabBarHeight: 0,
    });
  });

  it('keeps height-only tab navigator compatibility', () => {
    expect(
      getPageFooterBottomMetrics({
        bottom: 48,
        isNative: true,
        nativeTabBarHeight: 0,
        tabBarVisible: undefined,
      }),
    ).toEqual({
      footerSafeAreaBottom: 0,
      tabBarHeight: 48,
    });
  });
});
