import {
  OverlayContainer,
  Portal,
  ShowToastProvider,
  Toaster,
} from '@onekeyhq/components';

import { DevOverlayWindowContainer } from './DevOverlayWindowContainer';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function FullWindowOverlayContainer() {
  return (
    <OverlayContainer>
      <Portal.Container name={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL} />
      <ShowToastProvider />
      <DevOverlayWindowContainer />
      {/* E2E mode, enable tap in iOS */}
      {platformEnv.isE2E ? <></> : <Toaster />}
    </OverlayContainer>
  );
}
