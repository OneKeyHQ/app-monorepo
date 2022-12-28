import { useIsVerticalLayout } from '@onekeyhq/components';

import Desktop from './Desktop';
import Mobile from './Mobile';

import type { BottomTabBarProps } from '../BottomTabs/types';

export default function NavigationBar(props: BottomTabBarProps) {
  const isSmallLayout = useIsVerticalLayout();

  if (isSmallLayout) {
    return <Mobile {...props} />;
  }
  return <Desktop {...props} />;
}
