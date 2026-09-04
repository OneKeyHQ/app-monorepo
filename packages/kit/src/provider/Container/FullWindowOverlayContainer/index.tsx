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
          through the providers below.

          The wrapper is what gives the stage its viewport: MorphOverlay's
          layer anchors absolute to fill it, and OverlayContainer is a
          full-window host only on iOS — everywhere else it passes its
          children straight through, leaving the layer to resolve against
          whatever ancestor happens to be positioned. */}
      <Stack
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        pointerEvents="box-none"
        // RN 0.86 Fabric flattens this layout-only box-none container out
        // of the native hierarchy, which kills hit-testing for the whole
        // portal subtree (draws fine, touches dead). Keep the native view.
        collapsable={false}
      >
        <Portal.Container name={Portal.Constant.HARDWARE_UI_STATE_DIALOG} />
      </Stack>
      <ShowToastProvider />
      <DevOverlayWindowContainer />
      <TradingViewNativeDebugPanelContainer />
      {/* E2E mode, enable tap in iOS */}
      {platformEnv.isE2E ? <></> : <Toaster />}
      <ScreenshotBranding />
    </OverlayContainer>
  );
}
