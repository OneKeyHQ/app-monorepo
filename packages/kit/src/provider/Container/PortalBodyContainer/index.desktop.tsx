import { Portal } from '@onekeyhq/components';

import DesktopCustomTabBar from '../../../views/Discovery/pages/DesktopCustomTabBar';

export function PortalBodyContainer() {
  return (
    <Portal.Body container={Portal.Constant.WEB_TAB_BAR}>
      <DesktopCustomTabBar />
    </Portal.Body>
  );
}
