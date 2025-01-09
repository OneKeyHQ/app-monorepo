import { useMemo } from 'react';

import { Portal, useMedia } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import DesktopCustomTabBar from '../../../views/Discovery/pages/DesktopCustomTabBar';

export function WebPageTabBar() {
  const { gtMd } = useMedia();
  const memoDesktopCustomTabBar = useMemo(() => <DesktopCustomTabBar />, []);
  return platformEnv.isDesktop || (platformEnv.isNative && gtMd) ? (
    <Portal.Body container={Portal.Constant.WEB_TAB_BAR}>
      {memoDesktopCustomTabBar}
    </Portal.Body>
  ) : null;
}
