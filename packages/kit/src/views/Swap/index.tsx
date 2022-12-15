import React from 'react';

import {
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { Mobile } from './Mobile';
import { Desktop } from './Desktop';

const Swap = () => {
  const isSmall = useIsVerticalLayout();
  return isSmall ? <Mobile /> : <Desktop />;
};

export default Swap;
