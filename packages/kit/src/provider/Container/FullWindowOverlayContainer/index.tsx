import {
  OverlayContainer,
  Portal,
  ShowToastProvider,
  Toaster,
} from '@onekeyhq/components';

import { DevOverlayWindowContainer } from './DevOverlayWindowContainer';

export function FullWindowOverlayContainer() {
  return (
    <OverlayContainer>
      <Portal.Container name={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL} />
      <ShowToastProvider />
      <DevOverlayWindowContainer />
      <Toaster />
    </OverlayContainer>
  );
}
