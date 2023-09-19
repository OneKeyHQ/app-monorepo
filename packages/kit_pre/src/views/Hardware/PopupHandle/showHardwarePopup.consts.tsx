import type { HardwareUiEventPayload } from '@onekeyhq/kit/src/store/reducers/hardware';

export type HardwarePopup = {
  uiRequest?: string;
  payload?: HardwareUiEventPayload;
  content?: string;
};
export type PopupType = 'normal' | 'inputPin' | 'inputPassphrase';

export const CUSTOM_UI_RESPONSE = {
  // monorepo custom
  CUSTOM_CANCEL: 'ui-custom_cancel',
  CUSTOM_REQUEST_PIN_ON_DEVICE: 'ui-custom_request_pin_on_device',
  CUSTOM_NEED_ONEKEY_BRIDGE: 'ui-custom_need_onekey_bridge',
  CUSTOM_FORCE_UPGRADE_FIRMWARE: 'ui-custom_force_onekey_bridge',
  CUSTOM_NEED_UPGRADE_FIRMWARE: 'ui-custom_need_upgrade_firmware',
  CUSTOM_NEED_OPEN_PASSPHRASE: 'ui-custom_need_open_passphrase',
  CUSTOM_NEED_CLOSE_PASSPHRASE: 'ui-custom_need_close_passphrase',
};

export const UI_REQUEST = {
  REQUEST_PIN: 'ui-request_pin',
  INVALID_PIN: 'ui-invalid_pin',
  REQUEST_BUTTON: 'ui-button',
  REQUEST_PASSPHRASE: 'ui-request_passphrase',
  REQUEST_PASSPHRASE_ON_DEVICE: 'ui-request_passphrase_on_device',

  CLOSE_UI_WINDOW: 'ui-close_window',

  BLUETOOTH_PERMISSION: 'ui-bluetooth_permission',
  LOCATION_PERMISSION: 'ui-location_permission',
  LOCATION_SERVICE_PERMISSION: 'ui-location_service_permission',

  FIRMWARE_PROGRESS: 'ui-firmware-progress',
} as const;
