/* eslint-disable max-classes-per-file */
import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import type { LocaleIds } from '@onekeyhq/components/src/locale';
import type { OneKeyHardwareErrorPayload } from '@onekeyhq/engine/src/errors';
import { OneKeyHardwareError } from '@onekeyhq/engine/src/errors';

export enum CustomOneKeyHardwareError {
  NeedOneKeyBridge = 3030,
  // TODO: remove this error code
  NeedFirmwareUpgrade = 4030,
}

export class InvalidPIN extends OneKeyHardwareError {
  override code = HardwareErrorCode.PinInvalid;

  override key: LocaleIds = 'msg__hardware_invalid_pin_error';
}

export class InvalidPassphrase extends OneKeyHardwareError {
  override code = HardwareErrorCode.DeviceCheckPassphraseStateError;

  override key: LocaleIds = 'msg__hardware_device_passphrase_state_error';
}

export class DeviceNotOpenedPassphrase extends OneKeyHardwareError {
  override code = HardwareErrorCode.DeviceNotOpenedPassphrase;

  override key: LocaleIds = 'msg__hardware_not_opened_passphrase';
}

export class DeviceDataOverload extends OneKeyHardwareError {
  override code = HardwareErrorCode.DataOverload;

  override key: LocaleIds = 'msg__hardware_params_bytes_overload';
}

export class DeviceOpenedPassphrase extends OneKeyHardwareError {
  override code = HardwareErrorCode.DeviceOpenedPassphrase;

  override key: LocaleIds = 'msg__hardware_opened_passphrase';
}

export class UserCancel extends OneKeyHardwareError {
  override code = HardwareErrorCode.ActionCancelled;

  override key: LocaleIds = 'msg__hardware_user_cancel_error';
}

export class UserCancelFromOutside extends OneKeyHardwareError {
  override code = HardwareErrorCode.DeviceInterruptedFromOutside;

  // Don't remind
  override key: LocaleIds = 'msg__hardware_user_cancel_error';
}

export class UnknownMethod extends OneKeyHardwareError {
  override code = HardwareErrorCode.RuntimeError;

  override key: LocaleIds = 'msg__hardware_unknown_message_error';
}

export class ConnectTimeout extends OneKeyHardwareError {
  override key: LocaleIds = 'msg__hardware_connect_timeout_error';
}

export class NeedOneKeyBridge extends OneKeyHardwareError {
  override code = CustomOneKeyHardwareError.NeedOneKeyBridge;

  override key: LocaleIds = 'modal__need_install_onekey_bridge';
}

export class BridgeNetworkError extends OneKeyHardwareError {
  override code = HardwareErrorCode.BridgeNetworkError;

  override key: LocaleIds = 'msg__hardware_bridge_network_error';
}

export class BridgeTimeoutError extends OneKeyHardwareError {
  override code = HardwareErrorCode.BridgeTimeoutError;

  override key: LocaleIds = 'msg__hardware_bridge_timeout';
}

export class BridgeTimeoutErrorForDesktop extends OneKeyHardwareError {
  override code = HardwareErrorCode.BridgeTimeoutError;

  override key: LocaleIds = 'msg__hardware_bridge_timeout_for_desktop';
}

export class ConnectTimeoutError extends OneKeyHardwareError {
  override code = HardwareErrorCode.PollingTimeout;

  override key: LocaleIds = 'msg__hardware_polling_connect_timeout_error';
}

export class ConnectPollingStopError extends OneKeyHardwareError {
  override code = HardwareErrorCode.PollingStop;

  override key: LocaleIds = 'msg__hardware_polling_connect_timeout_error';
}

// 设备没有配对成功
export class DeviceNotBonded extends OneKeyHardwareError {
  override code = HardwareErrorCode.BleDeviceNotBonded;

  override key: LocaleIds = 'msg__hardware_bluetooth_not_paired_error';
}

// 设备配对失败
export class DeviceBondError extends OneKeyHardwareError {
  override code = HardwareErrorCode.BleDeviceBondError;

  override key: LocaleIds = 'msg__hardware_bluetooth_pairing_failed';
}

// 设备没有打开蓝牙
export class NeedBluetoothTurnedOn extends OneKeyHardwareError {
  override code = HardwareErrorCode.BlePermissionError;

  override key: LocaleIds = 'msg__hardware_bluetooth_need_turned_on_error';
}

// 没有使用蓝牙的权限
export class NeedBluetoothPermissions extends OneKeyHardwareError {
  override code = HardwareErrorCode.BleLocationError;

  override key: LocaleIds = 'msg__hardware_bluetooth_requires_permission_error';
}

export class BleLocationServiceError extends OneKeyHardwareError {
  override code = HardwareErrorCode.BleLocationServicesDisabled;

  override key: LocaleIds = 'msg__hardware_device_ble_location_disabled';
}

export class BleWriteCharacteristicError extends OneKeyHardwareError {
  override code = HardwareErrorCode.BleWriteCharacteristicError;

  override key: LocaleIds = 'msg__hardware_device_need_restart';
}

export class BleScanError extends OneKeyHardwareError {
  override code = HardwareErrorCode.BleScanError;

  override key: LocaleIds = 'msg__hardware_device_ble_scan_error';
}

export class BleAlreadyConnectedError extends OneKeyHardwareError {
  override code = HardwareErrorCode.BleAlreadyConnected;

  override key: LocaleIds = 'msg__hardware_device_ble_already_connected';
}

export class OpenBlindSign extends OneKeyHardwareError {
  override code = HardwareErrorCode.BlindSignDisabled;

  override key: LocaleIds = 'msg__hardware_open_blind_sign_error';
}

export class FirmwareVersionTooLow extends OneKeyHardwareError {
  override code = HardwareErrorCode.CallMethodNeedUpgradeFirmware;

  constructor(errorPayload?: OneKeyHardwareErrorPayload) {
    super(errorPayload, { 0: 'require' });
  }

  override key: LocaleIds = 'msg__hardware_version_need_upgrade_error';
}

export class NotInBootLoaderMode extends OneKeyHardwareError {
  override code = HardwareErrorCode.DeviceUnexpectedBootloaderMode;
}

export class FirmwareDownloadFailed extends OneKeyHardwareError {
  override code = HardwareErrorCode.FirmwareUpdateDownloadFailed;

  override data = { reconnect: true };

  override key: LocaleIds = 'msg__hardware_firmware_download_error';
}

export class FirmwareUpdateManuallyEnterBoot extends OneKeyHardwareError {
  override code = HardwareErrorCode.FirmwareUpdateManuallyEnterBoot;

  override data = { reconnect: true };

  override key: LocaleIds = 'msg__hardware_manually_enter_boot';
}

export class FirmwareUpdateAutoEnterBootFailure extends OneKeyHardwareError {
  override code = HardwareErrorCode.FirmwareUpdateAutoEnterBootFailure;

  override data = { reconnect: true };

  override key: LocaleIds = 'msg__hardware_enter_boot_failure';
}

export class FirmwareUpdateLimitOneDevice extends OneKeyHardwareError {
  override code = HardwareErrorCode.FirmwareUpdateLimitOneDevice;

  override data = { reconnect: true };

  override key: LocaleIds = 'modal__only_one_device_can_be_connected_desc';
}

export class NewFirmwareUnRelease extends OneKeyHardwareError {
  override code = HardwareErrorCode.NewFirmwareUnRelease;

  override data = { reconnect: true };

  override key: LocaleIds = 'msg__str_not_supported_by_hardware_wallets';
}

export class NewFirmwareForceUpdate extends OneKeyHardwareError {
  override code = HardwareErrorCode.NewFirmwareForceUpdate;

  override key: LocaleIds = 'msg__need_force_upgrade_firmware';
}

export class DeviceNotSame extends OneKeyHardwareError {
  override code = HardwareErrorCode.DeviceCheckDeviceIdError;

  override key: LocaleIds =
    'msg__device_information_is_inconsistent_it_may_caused_by_device_reset';
}

export class DeviceNotFind extends OneKeyHardwareError {
  override code = HardwareErrorCode.DeviceNotFound;

  override data = { reconnect: true };

  override key: LocaleIds = 'msg__hardware_device_not_find_error';
}

export class InitIframeLoadFail extends OneKeyHardwareError {
  override code = HardwareErrorCode.IFrameLoadFail;

  override key: LocaleIds = 'msg__hardware_init_iframe_load_error';
}

export class InitIframeTimeout extends OneKeyHardwareError {
  override code = HardwareErrorCode.IframeTimeout;

  override key: LocaleIds = 'msg__hardware_init_iframe_load_error';
}

export class NetworkError extends OneKeyHardwareError {
  override code = HardwareErrorCode.NetworkError;

  override data = { reconnect: true };

  override key: LocaleIds = 'title__no_connection_desc';
}

export class NotSupportPassphraseError extends OneKeyHardwareError {
  override code = HardwareErrorCode.DeviceNotSupportPassphrase;

  override key: LocaleIds = 'msg__not_support_passphrase_need_upgrade';

  constructor(errorPayload?: OneKeyHardwareErrorPayload) {
    super(errorPayload, { 0: 'require' });
  }
}

export class FileAlreadyExistError extends OneKeyHardwareError {
  override code = HardwareErrorCode.FileAlreadyExists;

  override key: LocaleIds = 'msg__file_already_exists';
}

export class IncompleteFileError extends OneKeyHardwareError {
  override code = HardwareErrorCode.CheckDownloadFileError;

  override key: LocaleIds = 'msg__incomplete_file';
}

export class NotInSigningModeError extends OneKeyHardwareError {
  override code = HardwareErrorCode.NotInSigningMode;

  override key: LocaleIds =
    'msg__transaction_signing_error_not_in_signing_mode';
}

// 未知错误
export class UnknownHardwareError extends OneKeyHardwareError {
  override data = { reconnect: true };
}
