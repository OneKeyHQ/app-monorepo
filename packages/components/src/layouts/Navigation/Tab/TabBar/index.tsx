import { useMedia } from '@onekeyhq/components/src/hooks/useStyle';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { DesktopLeftSideBar } from './DesktopLeftSideBar';
import MobileBottomTabBar from './MobileBottomTabBar';

import type { ITabNavigatorExtraConfig } from '../../Navigator/types';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const useShowMobileBottomTabBar = platformEnv.isNative
  ? () => true
  : () => {
      const media = useMedia();
      return media.md;
    };

export default function NavigationBar({
  ...props
}: BottomTabBarProps & {
  extraConfig?: ITabNavigatorExtraConfig<string>;
}) {
  const isShowMobileBottomTabBar = useShowMobileBottomTabBar();
  const { gtMd } = useMedia();

  if (platformEnv.isWebDappMode && gtMd) {
    return null;
  }

  if (platformEnv.isNativeAndroid || isShowMobileBottomTabBar) {
    return <MobileBottomTabBar {...props} />;
  }
  return <DesktopLeftSideBar {...props} />;
}
