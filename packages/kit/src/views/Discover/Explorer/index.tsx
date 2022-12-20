/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { FC } from 'react';
import { memo } from 'react';

import { Box, useIsVerticalLayout } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// import ExplorerDesktop from './Desktop/ExplorerDesktop';
// import ExplorerMobile from './Mobile/ExplorerMobile';

let ExplorerMobile: any;
let ExplorerDesktop: any;

if (platformEnv.isDesktop || platformEnv.isNativeIOSPad) {
  ExplorerDesktop = require('./Desktop/ExplorerDesktop').default;
} else if (platformEnv.isNative) {
  ExplorerMobile = require('./Mobile/ExplorerMobile').default;
}

const Explorer: FC = () => {
  const isVerticalLayout = useIsVerticalLayout();
  // lazy load
  if (isVerticalLayout && !ExplorerMobile) {
    ExplorerMobile = require('./Mobile/ExplorerMobile').default;
  } else if (!isVerticalLayout && !ExplorerDesktop) {
    ExplorerDesktop = require('./Desktop/ExplorerDesktop').default;
  }

  return (
    <Box flex={1} bg="background-default">
      {isVerticalLayout ? <ExplorerMobile /> : <ExplorerDesktop />}
    </Box>
  );
};

export default memo(Explorer);
