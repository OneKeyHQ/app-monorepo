import { ToastViewport } from '@tamagui/toast';

import { CustomToastProvider, Portal } from '@onekeyhq/components';

import { OverlayContainer } from './OverlayContainer';

export function FullWindowOverlayContainer() {
  return (
    <OverlayContainer>
      <Portal.Container name={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL} />
      <CustomToastProvider swipeDirection="up">
        <Portal.Container name={Portal.Constant.TOASTER_OVERLAY_PORTAL} />
      </CustomToastProvider>
    </OverlayContainer>
  );
}
