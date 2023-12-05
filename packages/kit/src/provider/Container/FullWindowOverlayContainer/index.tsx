import { Portal } from '@onekeyhq/components';
import DesktopCustomTabBar from '@onekeyhq/kit/src/views/Discovery/container/DesktopCustomTabBar';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { OverlayContainer } from './OverlayContainer';

export function FullWindowOverlayContainer() {
  return (
    <OverlayContainer>
      <Portal.Container name={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL} />
      {platformEnv.isDesktop ? (
        <Portal.Body container={Portal.Constant.WEB_TAB_BAR}>
          <DesktopCustomTabBar />
        </Portal.Body>
      ) : null}
    </OverlayContainer>
  );
}
