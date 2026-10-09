import { Portal, ShowToastProvider, Toaster } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ScreenshotBranding } from '../../../components/ScreenshotBranding';
import { TradingViewNativeFullscreenHost } from '../../../components/TradingView/TradingViewNative/TradingViewNativePresentation';

import { AccountSelectorMirrorInspectorContainer } from './AccountSelectorMirrorInspectorContainer';
import { DevOverlayWindowContainer } from './DevOverlayWindowContainer';
import { HardwareStageOverlayContainer } from './HardwareStageOverlayContainer';
import { ToastOverlayContainer } from './ToastOverlayContainer';
import { TradingViewNativeDebugPanelContainer } from './TradingViewNativeDebugPanelContainer';

// Every overlay here hosts itself in a native overlay level; this only mounts
// them and the imperative mount roots (`Dialog.show`, `ActionList.show`).
export function FullWindowOverlayContainer() {
  return (
    <>
      <TradingViewNativeFullscreenHost />
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
      {process.env.NODE_ENV !== 'production' &&
      platformEnv.isWeb &&
      (platformEnv.isDev || platformEnv.isE2E) ? (
        <AccountSelectorMirrorInspectorContainer />
      ) : null}
      <TradingViewNativeDebugPanelContainer />
      <ScreenshotBranding />
    </>
  );
}
