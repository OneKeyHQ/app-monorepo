/* eslint-disable max-classes-per-file */
import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { LocaleIds } from '@onekeyhq/components/src/locale';
import { OneKeyHardwareError } from '@onekeyhq/engine/src/errors';

export enum CustomOneKeyHardwareError {
  NeedOneKeyBridge = 3030,
}

export class InvalidPIN extends OneKeyHardwareError {
  override code = HardwareErrorCode.PinInvalid;

  override key: LocaleIds = 'msg__hardware_invalid_pin_error';
}

export class UserCancel extends OneKeyHardwareError {
  override code = HardwareErrorCode.ActionCancelled;

  override key: LocaleIds = 'msg__hardware_user_cancel_error';
}

export class UserCancelFromOutside extends OneKeyHardwareError {
  override code = HardwareErrorCode.DeviceInterruptedFromOutside;
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

// 设备没有配对成功
export class DeviceNotBonded extends OneKeyHardwareError {
  override code = HardwareErrorCode.DeviceNotFound;

  override key: LocaleIds = 'msg__hardware_bluetooth_not_paired_error';
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

export class OpenBlindSign extends OneKeyHardwareError {
  override code = HardwareErrorCode.RuntimeError;

  override key: LocaleIds = 'msg__hardware_open_blind_sign_error';
}

export class FirmwareVersionTooLow extends OneKeyHardwareError {
  override code = HardwareErrorCode.DeviceFwException;

  override key: LocaleIds = 'msg__hardware_version_to_low_error';
}

export class NotInBootLoaderMode extends OneKeyHardwareError {
  override code = HardwareErrorCode.DeviceUnexpectedBootloaderMode;
}

export class FirmwareDownloadFailed extends OneKeyHardwareError {
  override code = HardwareErrorCode.FirmwareUpdateDownloadFailed;

  override data = { reconnect: true };

  override key: LocaleIds = 'msg__hardware_firmware_download_error';
}

export class DeviceNotFind extends OneKeyHardwareError {
  override code = HardwareErrorCode.BleDeviceNotBonded;

  override data = { reconnect: true };

  override key: LocaleIds = 'msg__hardware_device_not_find_error';
}

export class InitIframeLoadFail extends OneKeyHardwareError {
  override code = HardwareErrorCode.IFrameLoadFail;

  override data = { reconnect: true };

  override key: LocaleIds = 'msg__hardware_init_iframe_load_error';
}

export class InitIframeTimeout extends OneKeyHardwareError {
  override code = HardwareErrorCode.IframeTimeout;

  override data = { reconnect: true };

  override key: LocaleIds = 'msg__hardware_init_iframe_load_error';
}
export class NetworkError extends OneKeyHardwareError {
  override code = HardwareErrorCode.NetworkError;

  override data = { reconnect: true };

  override key: LocaleIds = 'title__no_connection_desc';
}

// 未知错误
export class UnknownHardwareError extends OneKeyHardwareError {
  override data = { reconnect: true };
}
