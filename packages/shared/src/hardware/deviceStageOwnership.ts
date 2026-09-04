import { EHardwareUiStateAction } from '../../types/hardwareUi';

/**
 * Which hardware UI actions the DeviceStage plays (OK-59934).
 *
 * The stage replaced the popup surfaces for these; everything else still
 * belongs to the legacy container, and both sides read this one table so
 * an action can never be shown twice or by nobody.
 */
const STAGE_OWNED_ACTIONS: ReadonlySet<string> = new Set([
  EHardwareUiStateAction.DeviceChecking,
  EHardwareUiStateAction.ProcessLoading,
  EHardwareUiStateAction.DEVICE_PROGRESS,
  EHardwareUiStateAction.EnterPinOnDevice,
  EHardwareUiStateAction.REQUEST_PIN,
  EHardwareUiStateAction.REQUEST_BUTTON,
  EHardwareUiStateAction.REQUEST_PASSPHRASE,
  EHardwareUiStateAction.REQUEST_PASSPHRASE_ON_DEVICE,
]);

export function isDeviceStageOwnedHardwareUiAction({
  action,
  eventType,
  firmwareUpdateRunning,
}: {
  action: string | undefined;
  eventType?: string;
  /** The firmware update page owns its own surfaces start to finish — the
   * stage stands down for the whole workflow (handover doc §01). */
  firmwareUpdateRunning?: boolean;
}): boolean {
  if (!action || firmwareUpdateRunning) {
    return false;
  }
  // Bluetooth pairing rides in on DeviceChecking, but it is a system
  // pairing prompt, explicitly outside the stage's scope.
  if (eventType === EHardwareUiStateAction.BLUETOOTH_DEVICE_PAIRING) {
    return false;
  }
  return STAGE_OWNED_ACTIONS.has(action);
}

/**
 * Whether a DeviceStage burst currently owns the hardware flow. Set by the
 * burst scope in kit-bg; read where kit-bg cannot be imported — the
 * DeviceNotFound error emits its legacy dialog event from its own
 * constructor, before the failed call ever returns to the burst wrapper.
 * Module state is per-runtime, which is exactly right: the burst scope and
 * every DeviceNotFound construction live in the background runtime.
 */
let deviceStageBurstActive = false;

export function setDeviceStageBurstActive(active: boolean): void {
  deviceStageBurstActive = active;
}

/**
 * Whether the DeviceNotFound constructor should emit the legacy
 * "Device not connected" dialog event. While a burst is active the stage
 * lands the failure itself (the deviceNotFound outcome), and the UI-side
 * `stageIsShowing` gate cannot cover that case — an at-initiation failure
 * outruns the stage's deferred opening beat, so the event has to stand
 * down at the source. With no burst the legacy dialog remains the only
 * surface (bare calls, the firmware workflow) and the emit proceeds.
 */
export function shouldEmitDeviceNotFoundDialogEvent({
  silentMode,
}: {
  silentMode?: boolean;
}): boolean {
  return !silentMode && !deviceStageBurstActive;
}

/**
 * Whether the legacy container should still raise its hardware-error
 * dialog. One failure, one surface: when the stage is on it lands the
 * failure itself as its error outcome, but plenty of hardware work never
 * opens a stage burst at all — device search, the firmware update
 * workflow, calls outside any wrapper — and those failures would go
 * unseen if this dialog stood down unconditionally.
 */
export function shouldLegacyContainerRaiseHardwareErrorDialog({
  errorType,
  stageIsShowing,
}: {
  errorType: string | undefined;
  stageIsShowing: boolean;
}): boolean {
  if (errorType !== 'DeviceNotFound') {
    return false;
  }
  return !stageIsShowing;
}

/**
 * Whether the legacy popup surfaces the DeviceStage replaced are still in
 * play.
 *
 * They are switched off rather than deleted for the duration of this
 * integration: the code that used to drive them stays compiled,
 * type-checked and reviewable next to what replaced it, and flipping this
 * one function brings the old behavior back in a single step while the
 * replacement is still being proven on real devices. The cleanup pass
 * after the PR lands removes this switch and everything behind it.
 */
export function isLegacyHardwareUiActive(): boolean {
  return false;
}

export type IDeviceStageBackPressOutcome = 'close' | 'consume' | 'pass';

/**
 * Android back (and Escape on web, through the same hook) while the stage
 * is up. The stage is the surface, so the press must never reach the screen
 * underneath — the legacy container blocked it the same way while its
 * toast showed, and the legacy dialog mapped it to its close. Once the
 * close grant is armed the press IS the close button; before that it is
 * swallowed, like a dialog with system close disabled. Off stage it passes
 * through untouched.
 */
export function resolveDeviceStageBackPress({
  stageIsOn,
  closable,
}: {
  stageIsOn: boolean;
  closable: boolean;
}): IDeviceStageBackPressOutcome {
  if (!stageIsOn) {
    return 'pass';
  }
  return closable ? 'close' : 'consume';
}
