import { Portal } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { WebTabBarItem } from '../../WebTabBarItem';

import { OverlayContainer } from './OverlayContainer';

export function FullWindowOverlayContainer() {
  return (
    <OverlayContainer>
      <Portal.Container name={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL} />
      {platformEnv.isDesktop ? (
        <Portal.Body container={Portal.Constant.WEB_TAB_BAR}>
          <WebTabBarItem />
        </Portal.Body>
      ) : null}
    </OverlayContainer>
  );
}
