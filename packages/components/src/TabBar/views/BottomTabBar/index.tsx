import React from 'react';

import { useIsRootRoute, useUserDevice } from '../../../Provider/hooks';

import Desktop from './Desktop';
import Mobile from './Mobile';

import type { BottomTabBarProps } from '../../types';

export default function BottomTabBar(props: BottomTabBarProps) {
  const { size } = useUserDevice();
  const { isRootRoute } = useIsRootRoute();

  if (['SMALL', 'NORMAL'].includes(size)) {
    if (isRootRoute) {
      return <Mobile {...props} />;
    }
    return null;
  }
  return <Desktop {...props} />;
}
