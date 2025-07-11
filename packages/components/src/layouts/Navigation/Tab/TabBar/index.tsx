import { useMedia } from 'tamagui';

import { useOrientation } from '@onekeyhq/components/src/hooks/useOrientation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { DesktopLeftSideBar } from './DesktopLeftSideBar';
import MobileBottomTabBar from './MobileBottomTabBar';

import type { ITabNavigatorExtraConfig } from '../../Navigator/types';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const useShowMobileBottomTabBar = platformEnv.isNativeIOSPad
  ? () => {
      const isLandscape = useOrientation();
      return !isLandscape;
    }
  : () => {
      const media = useMedia();
      return media.md;
    };

export default function TabBar({
  ...props
}: BottomTabBarProps & {
  extraConfig?: ITabNavigatorExtraConfig<string>;
}) {
  const isShowMobileBottomTabBar = useShowMobileBottomTabBar();

  if (platformEnv.isNativeAndroid || isShowMobileBottomTabBar) {
    return <MobileBottomTabBar {...props} />;
  }
  return <DesktopLeftSideBar {...props} />;
}
