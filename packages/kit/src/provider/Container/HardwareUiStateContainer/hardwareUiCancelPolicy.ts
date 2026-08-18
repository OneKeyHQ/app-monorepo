import { EDeviceType } from '@onekeyfe/hd-shared';

import { isProtocolV2ProductType } from '@onekeyhq/shared/src/utils/hardwareDeviceTypes';
import { EHardwareUiStateAction } from '@onekeyhq/shared/types/hardwareUi';

import type { IDeviceType } from '@onekeyfe/hd-core';

const SKIP_CANCEL_ACTIONS = new Set<EHardwareUiStateAction>([
  EHardwareUiStateAction.FIRMWARE_TIP,
  EHardwareUiStateAction.FIRMWARE_PROGRESS,
  EHardwareUiStateAction.FIRMWARE_PROCESSING,
  EHardwareUiStateAction.CLOSE_UI_PIN_WINDOW,
  EHardwareUiStateAction.BLUETOOTH_PERMISSION,
  EHardwareUiStateAction.BLUETOOTH_CHARACTERISTIC_NOTIFY_CHANGE_FAILURE,
  EHardwareUiStateAction.LOCATION_PERMISSION,
  EHardwareUiStateAction.LOCATION_SERVICE_PERMISSION,
  EHardwareUiStateAction.WEB_DEVICE_PROMPT_ACCESS_PERMISSION,
]);

const SKIP_CANCEL_EVENT_TYPES = new Set<string>([
  EHardwareUiStateAction.BLUETOOTH_DEVICE_PAIRING,
  EHardwareUiStateAction.BLUETOOTH_PERMISSION_UNAUTHORIZED,
  EHardwareUiStateAction.DESKTOP_REQUEST_BLUETOOTH_PERMISSION,
  EHardwareUiStateAction.BLUETOOTH_UNSUPPORTED,
  EHardwareUiStateAction.BLUETOOTH_POWERED_OFF,
]);

export function shouldSkipHardwareDeviceCancel({
  action,
  eventType,
  deviceType,
}: {
  action?: EHardwareUiStateAction | string;
  eventType?: string;
  deviceType?: IDeviceType | string | null;
}): boolean {
  // Protocol V2 Cancel exists only on Pro 2 / Neo. A known older device
  // should never receive a follow-up Cancel from the app UI.
  if (
    deviceType &&
    deviceType !== EDeviceType.Unknown &&
    !isProtocolV2ProductType(deviceType)
  ) {
    return true;
  }

  if (action && SKIP_CANCEL_ACTIONS.has(action as EHardwareUiStateAction)) {
    return true;
  }

  if (eventType && SKIP_CANCEL_EVENT_TYPES.has(eventType)) {
    return true;
  }

  return false;
}
