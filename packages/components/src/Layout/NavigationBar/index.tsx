import { useIsVerticalLayout } from '@onekeyhq/components';

import DesktopSideBar from './DesktopSideBar';
import MobileTabBar from './MobileTabBar';

import type { BottomTabBarProps } from '../BottomTabs';

export default function NavigationBar(props: BottomTabBarProps) {
  const isSmallLayout = useIsVerticalLayout();

  if (isSmallLayout) {
    return <MobileTabBar {...props} />;
  }
  return <DesktopSideBar {...props} />;
}
