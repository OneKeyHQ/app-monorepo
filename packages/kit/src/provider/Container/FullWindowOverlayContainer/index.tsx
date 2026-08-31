import {
  OverlayContainer,
  Portal,
  ShowToastProvider,
  Toaster,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ScreenshotBranding } from '../../../components/ScreenshotBranding';

import { DevOverlayWindowContainer } from './DevOverlayWindowContainer';
import { TradingViewNativeDebugPanelContainer } from './TradingViewNativeDebugPanelContainer';

export function FullWindowOverlayContainer() {
  return (
    <OverlayContainer>
      <Portal.Container name={Portal.Constant.SPOTLIGHT_OVERLAY_PORTAL} />
      <Portal.Container name={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL} />
      {/* The hardware stage's window (see MorphOverlay): inside the
          full-window overlay because the flows that raise it start on
          native modal pages (send, receive, onboarding), which on iOS
          present above the root view — outside this overlay the stage
          opened underneath them. After the dialog portal because dialogs
          raise hardware flows too (batch create's progress dialog, the
          device-management confirms) and must not bury the stage they
          just summoned — the hardware dialogs this stage replaces won
          the same spot temporally, by showing later. The mirror case is
          the driver's to sequence: a prompt that must interrupt a LIVE
          stage hides the stage first (password prompts don't — they
          gate before the device call ever starts). Toasts stay above
          through the providers below. */}
      <Portal.Container name={Portal.Constant.HARDWARE_UI_STATE_DIALOG} />
      <ShowToastProvider />
      <DevOverlayWindowContainer />
      <TradingViewNativeDebugPanelContainer />
      {/* E2E mode, enable tap in iOS */}
      {platformEnv.isE2E ? <></> : <Toaster />}
      <ScreenshotBranding />
    </OverlayContainer>
  );
}
