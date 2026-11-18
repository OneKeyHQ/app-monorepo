import { createContext } from 'react';

export const BottomTabBarVisibilityContext = createContext<boolean | undefined>(
  undefined,
);

export const BottomTabBarVerticalContext = createContext(false);

// A vertical tab bar reports its full column height but sits in a side strip,
// so only the bottom safe area is left for content to reserve.
export function getNativeTabBarHeight({
  bottom,
  isVerticalTabBar,
  measuredHeight,
}: {
  bottom: number;
  isVerticalTabBar: boolean;
  measuredHeight: number | undefined;
}) {
  return isVerticalTabBar && measuredHeight !== undefined
    ? bottom
    : measuredHeight;
}

export function getPageFooterBottomMetrics({
  bottom,
  isNative,
  nativeTabBarHeight,
  tabBarVisible,
}: {
  bottom: number;
  isNative: boolean | undefined;
  nativeTabBarHeight: number | undefined;
  tabBarVisible: boolean | undefined;
}) {
  // Fall back to the height provider for tab navigators that do not expose visibility.
  const tabBarOwnsSafeArea = tabBarVisible ?? nativeTabBarHeight !== undefined;

  return {
    footerSafeAreaBottom: isNative && !tabBarOwnsSafeArea ? bottom : 0,
    tabBarHeight: tabBarOwnsSafeArea ? nativeTabBarHeight || bottom || 0 : 0,
  };
}
