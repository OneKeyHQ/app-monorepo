export enum EHardwareUiStateAction {
  DeviceChecking = 'DeviceChecking',
  EnterPinOnDevice = 'EnterPinOnDevice',
  ProcessLoading = 'ProcessLoading',

  // @onekeyfe/hd-core UI_REQUEST const map ----------------------------------------------

  REQUEST_PIN = 'ui-request_pin',
  REQUEST_PIN_TYPE_PIN_ENTRY = 'ButtonRequest_PinEntry',
  REQUEST_PIN_TYPE_ATTACH_PIN = 'ButtonRequest_AttachPin',
  INVALID_PIN = 'ui-invalid_pin',
  REQUEST_BUTTON = 'ui-button',
  REQUEST_PASSPHRASE = 'ui-request_passphrase',
  REQUEST_PASSPHRASE_ON_DEVICE = 'ui-request_passphrase_on_device',
  REQUEST_DEVICE_IN_BOOTLOADER_FOR_WEB_DEVICE = 'ui-request_select_device_in_bootloader_for_web_device',
  REQUEST_DEVICE_FOR_SWITCH_FIRMWARE_WEB_DEVICE = 'ui-request_select_device_for_switch_firmware_web_device',

  CLOSE_UI_WINDOW = 'ui-close_window',
  CLOSE_UI_PIN_WINDOW = 'ui-close_pin_window',
  DEVICE_PROGRESS = 'ui-device_progress',

  BLUETOOTH_PERMISSION = 'ui-bluetooth_permission',
  BLUETOOTH_CHARACTERISTIC_NOTIFY_CHANGE_FAILURE = 'ui-bluetooth_characteristic_notify_change_failure',
  LOCATION_PERMISSION = 'ui-location_permission',
  LOCATION_SERVICE_PERMISSION = 'ui-location_service_permission',

  FIRMWARE_PROCESSING = 'ui-firmware-processing',
  FIRMWARE_PROGRESS = 'ui-firmware-progress',
  FIRMWARE_TIP = 'ui-firmware-tip',

  PREVIOUS_ADDRESS = 'ui-previous_address_result',

  WEB_DEVICE_PROMPT_ACCESS_PERMISSION = 'ui-web_device_prompt_access_permission',
  DESKTOP_REQUEST_BLUETOOTH_PERMISSION = 'ui-desktop_request_bluetooth_permission',
  BLUETOOTH_PERMISSION_UNAUTHORIZED = 'ui-bluetooth_permission_unauthorized',
  BLUETOOTH_DEVICE_PAIRING = 'ui-bluetooth_device_pairing',
  BLUETOOTH_UNSUPPORTED = 'ui-bluetooth_unsupported',
  BLUETOOTH_POWERED_OFF = 'ui-bluetooth_powered_off',
}
