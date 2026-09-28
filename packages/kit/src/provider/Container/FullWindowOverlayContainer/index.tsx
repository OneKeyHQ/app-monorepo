import {
  OverlayContainer,
  Portal,
  ShowToastProvider,
  Toaster,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ScreenshotBranding } from '../../../components/ScreenshotBranding';
import { TradingViewNativeFullscreenHost } from '../../../components/TradingView/TradingViewNative/TradingViewNativePresentation';

import { DevOverlayWindowContainer } from './DevOverlayWindowContainer';
import { HardwareStageOverlayContainer } from './HardwareStageOverlayContainer';
import { ToastOverlayContainer } from './ToastOverlayContainer';
import { TradingViewNativeDebugPanelContainer } from './TradingViewNativeDebugPanelContainer';

export function FullWindowOverlayContainer() {
  return (
    <OverlayContainer>
      <TradingViewNativeFullscreenHost />
      <Portal.Container name={Portal.Constant.SPOTLIGHT_OVERLAY_PORTAL} />
      <Portal.Container name={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL} />
      {/* The hardware stage renders in the native `hardware` overlay level:
          above dialogs and sheets (including native modal pages the flows
          start on), below password prompts, toasts and the lock screen. */}
      <HardwareStageOverlayContainer>
        <Portal.Container name={Portal.Constant.HARDWARE_UI_STATE_DIALOG} />
      </HardwareStageOverlayContainer>
      {/* Custom toasts (Toast.show) host themselves in the native `toast`
          overlay level; the portal they render through can live anywhere. */}
      <ShowToastProvider />
      {/* The message toasts: the native `toast` level keeps them above
          dialogs, sheets and the hardware stage on every platform. */}
      <ToastOverlayContainer>
        {/* E2E mode, enable tap in iOS */}
        {platformEnv.isE2E ? <></> : <Toaster />}
      </ToastOverlayContainer>
      <DevOverlayWindowContainer />
      <TradingViewNativeDebugPanelContainer />
      <ScreenshotBranding />
    </OverlayContainer>
  );
}
