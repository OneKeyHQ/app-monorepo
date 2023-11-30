/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { memo } from 'react';

import { Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

let DesktopBrowser: any;
let MobileBrowser: any;

if (platformEnv.isDesktop) {
  DesktopBrowser = require('./DesktopBrowser').default;
} else if (platformEnv.isNative) {
  MobileBrowser = require('./MobileBrowser').default;
}

function Browser() {
  return (
    <Stack flex={1}>
      {platformEnv.isNative ? <MobileBrowser /> : <DesktopBrowser />}
    </Stack>
  );
}

export default memo(Browser);
