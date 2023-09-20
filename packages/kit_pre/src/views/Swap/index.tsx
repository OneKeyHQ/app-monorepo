import type { ReactNode } from 'react';

import { Box, useIsVerticalLayout } from '@onekeyhq/components';

import { Desktop } from './Desktop';
import { Mobile } from './Mobile';

const Swap = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  hideBottomTabBar,
}: { hideBottomTabBar?: boolean; children?: ReactNode } = {}) => {
  // useHideTabNavigatorHeader();
  const isSmall = useIsVerticalLayout();
  return isSmall ? (
    <Box flex={1}>
      <Mobile />
    </Box>
  ) : (
    <Desktop />
  );
};

export default Swap;
