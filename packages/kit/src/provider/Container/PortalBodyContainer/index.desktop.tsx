import { useMemo } from 'react';

import { Portal } from '@onekeyhq/components';

import DesktopCustomTabBar from '../../../views/Discovery/pages/DesktopCustomTabBar';

export function PortalBodyContainer() {
  const memoDesktopCustomTabBar = useMemo(() => <DesktopCustomTabBar />, []);
  return (
    <Portal.Body container={Portal.Constant.WEB_TAB_BAR}>
      {memoDesktopCustomTabBar}
    </Portal.Body>
  );
}
