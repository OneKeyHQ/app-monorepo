import { useMemo } from 'react';

import { Portal, useMedia } from '@onekeyhq/components';

import DesktopCustomTabBar from '../../../views/Discovery/pages/DesktopCustomTabBar';

export function PortalBodyContainer() {
  const { md } = useMedia();
  const memoDesktopCustomTabBar = useMemo(() => <DesktopCustomTabBar />, []);
  return md ? null : (
    <Portal.Body container={Portal.Constant.WEB_TAB_BAR}>
      {memoDesktopCustomTabBar}
    </Portal.Body>
  );
}
