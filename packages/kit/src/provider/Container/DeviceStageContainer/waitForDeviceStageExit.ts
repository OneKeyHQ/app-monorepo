import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

/** How long the shell takes to clear the screen once the driver has
 * answered off — the MorphOverlay sink, read generously. */
const DEVICE_STAGE_EXIT_BEAT_MS = 350;
/** Bounded: a stage that never leaves on its own (an outcome waiting on
 * the person) must not hang the caller's own change behind it. */
const DEVICE_STAGE_EXIT_TIMEOUT_MS = 4000;

/**
 * Waits for the stage to leave the screen — for a surface that raised a
 * hardware flow and now changes itself (a dialog closing, a page turning
 * to its ready state). The stage's exit reads first and the surface's
 * change after it, the mirror of the entrance, where the surface stood
 * still while the stage arrived (OK-62228, OK-62172, OK-62092).
 * Resolves at once when nothing is on stage — and nothing just left it:
 * the background reports an off it wrote within the last second as a
 * wait too, since that exit is still crossing to this runtime and
 * sinking off screen, so the beat below still applies.
 */
export async function waitForDeviceStageExit() {
  const exiting =
    await backgroundApiProxy.serviceHardwareUI.deviceStageWaitForOff({
      timeoutMs: DEVICE_STAGE_EXIT_TIMEOUT_MS,
    });
  if (exiting) {
    await timerUtils.wait(DEVICE_STAGE_EXIT_BEAT_MS);
  }
}

/**
 * A dialog is about to take the screen over a live stage (the Ledger
 * install sheet, OK-62656): the stage yields first — its burst's
 * bookkeeping untouched, so the hold's own end still releases it and the
 * device's next word repaints — and when a stage really left, its exit
 * beat plays before the dialog rises. One background hop: the yield
 * already knows whether it wrote the off.
 */
export async function yieldDeviceStageToDialog() {
  const left =
    await backgroundApiProxy.serviceHardwareUI.deviceStageYieldToDialog();
  if (left) {
    await timerUtils.wait(DEVICE_STAGE_EXIT_BEAT_MS);
  }
}
