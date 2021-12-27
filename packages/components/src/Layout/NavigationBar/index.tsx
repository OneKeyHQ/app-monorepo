import React from 'react';

import { useUserDevice } from '../../Provider/hooks';

import Desktop from './Desktop';
import Mobile from './Mobile';

import type { ChildProps } from '..';

export default function NavigationBar(props: ChildProps) {
  const { size } = useUserDevice();

  if (['SMALL', 'NORMAL'].includes(size)) {
    return <Mobile {...props} />;
  }
  return <Desktop {...props} />;
}
