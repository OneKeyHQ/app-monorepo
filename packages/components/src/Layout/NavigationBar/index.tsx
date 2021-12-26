import React from 'react';

import { useUserDevice } from '../../Provider/hooks';

import Desktop from './Desktop';
import Mobile from './Mobile';

export default function NavigationBar(props) {
  const { size } = useUserDevice();

  if (['SMALL', 'NORMAL'].includes(size)) {
    return <Mobile {...props} />;
  }
  return <Desktop {...props} />;
}
