/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { memo } from 'react';

import { Stack, useIsVerticalLayout } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

let ExplorerDesktop: any;
let ExplorerMobile: any;

if (platformEnv.isDesktop || platformEnv.isNativeIOSPad) {
  ExplorerDesktop = require('./Desktop/ExplorerDesktop').default;
} else if (platformEnv.isNative) {
  ExplorerMobile = require('./Mobile/ExplorerMobile').default;
}

function Explorer() {
  const isVerticalLayout = useIsVerticalLayout();
  // lazy load
  if (isVerticalLayout && !ExplorerMobile) {
    ExplorerMobile = require('./Mobile/ExplorerMobile').default;
  } else if (!isVerticalLayout && !ExplorerDesktop) {
    ExplorerDesktop = require('./Desktop/ExplorerDesktop').default;
  }

  return (
    <Stack flex={1} bg="background-default">
      {isVerticalLayout ? <ExplorerMobile /> : <ExplorerDesktop />}
    </Stack>
  );
}

export default memo(Explorer);
