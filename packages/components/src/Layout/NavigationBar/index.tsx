import React from 'react';

import { useIsSmallLayout } from '../../Provider/hooks';

import Desktop from './Desktop';
import Mobile from './Mobile';

import type { BottomTabBarProps } from '../BottomTabs/types';

export default function NavigationBar(props: BottomTabBarProps) {
  const isSmallLayout = useIsSmallLayout();

  if (isSmallLayout) {
    return <Mobile {...props} />;
  }
  return <Desktop {...props} />;
}
