/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { memo } from 'react';

import { Stack, useIsVerticalLayout } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

let DesktopBrowser: any;
let MobileBrowser: any;

if (platformEnv.isDesktop || platformEnv.isNativeIOSPad) {
  DesktopBrowser = require('./DesktopBrowser').default;
} else if (platformEnv.isNative) {
  MobileBrowser = require('./MobileBrowser').default;
}

function Browser() {
  const isVerticalLayout = useIsVerticalLayout();
  // lazy load
  if (isVerticalLayout && !MobileBrowser) {
    MobileBrowser = require('./MobileBrowser').default;
  } else if (!isVerticalLayout && !DesktopBrowser) {
    DesktopBrowser = require('./DesktopBrowser').default;
  }

  return (
    <Stack flex={1}>
      {isVerticalLayout ? <MobileBrowser /> : <DesktopBrowser />}
    </Stack>
  );
}

export default memo(Browser);
