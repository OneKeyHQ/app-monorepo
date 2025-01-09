import { useMedia } from 'tamagui';

import { DesktopLeftSideBar } from './DesktopLeftSideBar';
import MobileBottomTabBar from './MobileBottomTabBar';

import type { ITabNavigatorExtraConfig } from '../../Navigator/types';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs/src/types';

export default function TabBar({
  ...props
}: BottomTabBarProps & {
  extraConfig?: ITabNavigatorExtraConfig<string>;
}) {
  const media = useMedia();

  if (media.md) {
    return <MobileBottomTabBar {...props} />;
  }
  return <DesktopLeftSideBar {...props} />;
}
