import { useEffect, useRef, useState } from 'react';

import {
  OverlayContainer,
  Portal,
  ShowToastProvider,
  Stack,
  Toaster,
} from '@onekeyhq/components';
import { useDeviceStageAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { HARDWARE_STAGE_Z_INDEX } from '@onekeyhq/shared/src/consts/zIndexConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ScreenshotBranding } from '../../../components/ScreenshotBranding';
import { TradingViewNativeFullscreenHost } from '../../../components/TradingView/TradingViewNative/TradingViewNativePresentation';

import { DevOverlayWindowContainer } from './DevOverlayWindowContainer';
import { TradingViewNativeDebugPanelContainer } from './TradingViewNativeDebugPanelContainer';

export function FullWindowOverlayContainer() {
  // The stage's raise token (OK-62422): iOS stacks window overlays in the
  // order they were added, so the stage's overlay — mounted at app start —
  // sat under any modal dialog's own overlay opened later (the passphrase
  // enable dialog raising a device confirm was the report). Bumping the
  // token on each hidden → shown crossing re-fronts the stage's container
  // at that moment: above everything presented before it, while anything
  // presented after it still lands on top, as the temporal rule already
  // reads. Render-time ref writes on purpose — idempotent, and the token
  // must change in the same commit the stage starts entering.
  const [stage] = useDeviceStageAtom();
  const stageShown = Boolean(stage?.step) && stage?.step !== 'off';
  const stageWasShownRef = useRef(false);
  const stageRaiseTokenRef = useRef(0);
  if (stageShown && !stageWasShownRef.current) {
    stageRaiseTokenRef.current += 1;
  }
  stageWasShownRef.current = stageShown;
  const stageRaiseToken = stageRaiseTokenRef.current;
  // The toast layer follows every stage raise: iOS orders native window
  // containers by their last re-front, and TOAST_Z_INDEX cannot reach
  // across them, so toasts hosted beside the stage would slip under it.
  // Bumped from an effect — a commit of its own, guaranteed to land after
  // the stage's re-front in the commit before it.
  const [toastRaiseToken, setToastRaiseToken] = useState(0);
  useEffect(() => {
    setToastRaiseToken((token) => token + 1);
  }, [stageRaiseToken]);

  return (
    <OverlayContainer>
      <TradingViewNativeFullscreenHost />
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
          gate before the device call ever starts). Toasts keep their
          own overlay right after this one, re-fronted on its heels.

          Source order alone only holds on native: on web a Dialog carries
          an explicit z-index (useOverlayZIndex, 99 999 and up) and paints
          over a later sibling at z-index auto, so the desktop stage sat
          under the dialog's own scrim (OK-62228). The wrapper's z-index
          makes the order explicit on every platform.

          The wrapper is what gives the stage its viewport: MorphOverlay's
          layer anchors absolute to fill it, and OverlayContainer is a
          full-window host only on iOS — everywhere else it passes its
          children straight through, leaving the layer to resolve against
          whatever ancestor happens to be positioned. */}
      {/* Its own overlay on iOS (a nested FullWindowOverlay is its own
          window container, the way over-top dialogs already nest one),
          so the raise token re-fronts the stage alone and never the
          siblings above. Elsewhere OverlayContainer is a pass-through. */}
      <OverlayContainer bringToFrontToken={stageRaiseToken}>
        <Stack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={HARDWARE_STAGE_Z_INDEX}
          pointerEvents="box-none"
          // RN 0.86 Fabric flattens this layout-only box-none container out
          // of the native hierarchy, which kills hit-testing for the whole
          // portal subtree (draws fine, touches dead). Keep the native view.
          collapsable={false}
        >
          <Portal.Container name={Portal.Constant.HARDWARE_UI_STATE_DIALOG} />
        </Stack>
      </OverlayContainer>
      {/* The toasts' own overlay: mounted after the stage's and re-fronted
          right after each stage raise, so a toast during a hardware flow
          still paints and taps above the stage on iOS. Elsewhere
          OverlayContainer is a pass-through and z-index keeps the order. */}
      <OverlayContainer bringToFrontToken={toastRaiseToken}>
        <ShowToastProvider />
        {/* E2E mode, enable tap in iOS */}
        {platformEnv.isE2E ? <></> : <Toaster />}
      </OverlayContainer>
      <DevOverlayWindowContainer />
      <TradingViewNativeDebugPanelContainer />
      <ScreenshotBranding />
    </OverlayContainer>
  );
}
