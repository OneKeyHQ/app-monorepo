import { createContext } from 'react';

export const BottomTabBarVisibilityContext = createContext<boolean | undefined>(
  undefined,
);

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
