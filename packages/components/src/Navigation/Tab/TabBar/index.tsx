import useIsVerticalLayout from '@onekeyhq/components/src/Provider/hooks/useIsVerticalLayout';

import DesktopLeftSideBar from './DesktopLeftSideBar';
import MobileBottomTabBar from './MobileBottomTabBar';

import type { BottomTabBarProps } from '@react-navigation/bottom-tabs/src/types';

export default function TabBar({ ...props }: BottomTabBarProps) {
  const isVerticalLayout = useIsVerticalLayout();

  if (isVerticalLayout) {
    return <MobileBottomTabBar {...props} />;
  }
  return <DesktopLeftSideBar {...props} />;
}
