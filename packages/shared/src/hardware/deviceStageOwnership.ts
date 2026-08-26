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
