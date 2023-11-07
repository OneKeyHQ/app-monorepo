/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { memo } from 'react';

import { Stack } from '@onekeyhq/components';
import useIsVerticalLayout from '@onekeyhq/components/src/Provider/hooks/useIsVerticalLayout';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

let DesktopBrowser: any;
let MobileBrowser: any;

if (platformEnv.isDesktop || platformEnv.isNativeIOSPad) {
  DesktopBrowser =
    require('../../components/MobileBrowser/MobileBrowser').default;
} else if (platformEnv.isNative) {
  MobileBrowser =
    require('../../components/MobileBrowser/MobileBrowser').default;
}

function Browser() {
  const isVerticalLayout = useIsVerticalLayout();
  // lazy load
  if (isVerticalLayout && !MobileBrowser) {
    MobileBrowser =
      require('../../components/MobileBrowser/MobileBrowser').default;
  } else if (!isVerticalLayout && !DesktopBrowser) {
    DesktopBrowser =
      require('../../components/MobileBrowser/MobileBrowser').default;
  }

  return (
    <Stack flex={1} bg="background-default">
      {isVerticalLayout ? <MobileBrowser /> : <DesktopBrowser />}
    </Stack>
  );
}

export default memo(Browser);
