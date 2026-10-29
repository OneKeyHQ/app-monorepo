import { Toaster } from '@onekeyhq/components';
import { ImperativeOverlayMountHost } from '@onekeyhq/components/src/shared/imperativeOverlayMount';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ScreenshotBranding } from '../../../components/ScreenshotBranding';
import { TradingViewNativeFullscreenHost } from '../../../components/TradingView/TradingViewNative/TradingViewNativeFullscreenHost';

import { AccountSelectorMirrorInspectorContainer } from './AccountSelectorMirrorInspectorContainer';
import { DevOverlayWindowContainer } from './DevOverlayWindowContainer';
import { HardwareStageOverlayContainer } from './HardwareStageOverlayContainer';
import { PrivacyChainSyncLight } from './PrivacyChainSyncLight';
import { ToastOverlayContainer } from './ToastOverlayContainer';
import { TradingViewNativeDebugPanelContainer } from './TradingViewNativeDebugPanelContainer';

// The React hosts stay outside frozen screens. Each overlay still owns its
// native level and presentation through the SDK.
export function FullWindowOverlayContainer() {
  return (
    <>
      <TradingViewNativeFullscreenHost />
      <ImperativeOverlayMountHost target="global" />
      <ImperativeOverlayMountHost target="page" />
      {/* The hardware stage renders in the native `hardware` overlay level:
          above dialogs and sheets (including native modal pages the flows
          start on), below password prompts, toasts and the lock screen. */}
      <HardwareStageOverlayContainer>
        <ImperativeOverlayMountHost target="hardware-stage" />
      </HardwareStageOverlayContainer>
      {/* Custom toasts (Toast.show) host themselves in the native `toast`
          overlay level. */}
      {/* The message toasts: the native `toast` level keeps them above
          dialogs, sheets and the hardware stage on every platform. */}
      <ToastOverlayContainer>
        {/* E2E mode, enable tap in iOS */}
        {platformEnv.isE2E ? <></> : <Toaster />}
      </ToastOverlayContainer>
      <DevOverlayWindowContainer />
      <PrivacyChainSyncLight />
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
