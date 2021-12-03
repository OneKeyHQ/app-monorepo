import React from 'react';

import Foot from './Foot';
import Side from './Side';

import type { BottomTabBarProps } from '../../types';
import { useUserDevice } from '../../../Provider/hooks';

export default function BottomTabBar(props: BottomTabBarProps) {
  const { size } = useUserDevice();

  if (['SMALL', 'NORMAL'].includes(size)) {
    return <Foot {...props} />;
  }

  return <Side {...props} />;
}
