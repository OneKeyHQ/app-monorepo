import useIsVerticalLayout from '@onekeyhq/components/src/Provider/hooks/useIsVerticalLayout';

import DesktopLeftSideBar from './DesktopLeftSideBar';
import MobileBottomTabBar from './MobileBottomTabBar';

import type { BottomTabBarProps } from '../BottomTabs';

export default function TabBar({ ...props }: BottomTabBarProps) {
  const isVerticalLayout = useIsVerticalLayout();

  if (isVerticalLayout) {
    return <MobileBottomTabBar {...props} />;
  }
  return <DesktopLeftSideBar {...props} />;
}
