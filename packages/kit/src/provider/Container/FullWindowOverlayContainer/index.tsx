import {
  OverlayContainer,
  Portal,
  ShowToastProvider,
  Stack,
  Toaster,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ScreenshotBranding } from '../../../components/ScreenshotBranding';

import { DevOverlayWindowContainer } from './DevOverlayWindowContainer';
import { TradingViewNativeDebugPanelContainer } from './TradingViewNativeDebugPanelContainer';

export function FullWindowOverlayContainer() {
  return (
    <>
      <OverlayContainer>
        <Portal.Container name={Portal.Constant.SPOTLIGHT_OVERLAY_PORTAL} />
        <Portal.Container name={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL} />
        <ShowToastProvider />
        <DevOverlayWindowContainer />
        <TradingViewNativeDebugPanelContainer />
        {/* E2E mode, enable tap in iOS */}
        {platformEnv.isE2E ? <></> : <Toaster />}
        <ScreenshotBranding />
      </OverlayContainer>
      {/* DeviceStage's MorphOverlay anchors absolute inside this viewport;
          it needs a full-window positioned ancestor to sit at the bottom. */}
      <Stack
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        pointerEvents="box-none"
      >
        <Portal.Container name={Portal.Constant.HARDWARE_UI_STATE_DIALOG} />
      </Stack>
    </>
  );
}
