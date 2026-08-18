import { EHardwareUiStateAction } from '@onekeyhq/shared/types/hardwareUi';

const SKIP_CANCEL_ACTIONS = new Set<EHardwareUiStateAction>([
  EHardwareUiStateAction.FIRMWARE_TIP,
  EHardwareUiStateAction.FIRMWARE_PROGRESS,
  EHardwareUiStateAction.FIRMWARE_PROCESSING,
  EHardwareUiStateAction.CLOSE_UI_PIN_WINDOW,
]);

export function shouldSkipHardwareDeviceCancel({
  action,
}: {
  action?: EHardwareUiStateAction | string;
  eventType?: string;
  deviceType?: string | null;
}): boolean {
  // Firmware install and SDK-owned pin-window close are App workflow
  // lifetime, not protocol Cancel policy. Device type and pairing skips
  // belong in the SDK.
  return Boolean(
    action && SKIP_CANCEL_ACTIONS.has(action as EHardwareUiStateAction),
  );
}
