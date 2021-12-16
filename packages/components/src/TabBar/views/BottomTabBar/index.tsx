import React from 'react';

import Foot from './Foot';
import Side from './Side';

import type { BottomTabBarProps } from '../../types';
import { useIsRootRoute, useUserDevice } from '../../../Provider/hooks';

export default function BottomTabBar(props: BottomTabBarProps) {
  const { size } = useUserDevice();
  const { isRootRoute } = useIsRootRoute();

  if (['SMALL', 'NORMAL'].includes(size)) {
    if (isRootRoute) {
      return <Foot {...props} />;
    }
    return null;
  }

  return <Side {...props} />;
}
