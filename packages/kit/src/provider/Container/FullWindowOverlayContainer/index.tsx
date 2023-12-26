import { ToastViewport } from '@tamagui/toast';

import { CustomToastProvider, Portal } from '@onekeyhq/components';

import { OverlayContainer } from './OverlayContainer';

export function FullWindowOverlayContainer() {
  return (
    <OverlayContainer>
      <Portal.Container name={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL} />
      <CustomToastProvider>
        <ToastViewport name="CustomViewPort" top={0} alignContent="center" />

        <Portal.Container name={Portal.Constant.TOASTER_OVERLAY_PORTAL} />
      </CustomToastProvider>
    </OverlayContainer>
  );
}
