/* eslint-disable max-classes-per-file */
import { LocaleIds } from '@onekeyhq/components/src/locale';
import { OneKeyHardwareError } from '@onekeyhq/engine/src/errors';

export class InvalidPIN extends OneKeyHardwareError {
  override key: LocaleIds = 'msg__hardware_invalid_pin_error';
}

export class UserCancel extends OneKeyHardwareError {
  override key: LocaleIds = 'msg__hardware_user_cancel_error';
}

export class UnknownMethod extends OneKeyHardwareError {
  override key: LocaleIds = 'msg__hardware_unknown_message_error';
}

export class ConnectTimeout extends OneKeyHardwareError {
  override key: LocaleIds = 'msg__hardware_connect_timeout_error';
}

export class NeedOneKeyBridge extends OneKeyHardwareError {
  override key: LocaleIds = 'modal__need_install_onekey_bridge';
}

// 设备没有配对成功
export class DeviceNotBonded extends OneKeyHardwareError {
  override key: LocaleIds = 'msg__hardware_bluetooth_not_paired_error';
}

// 设备没有打开蓝牙
export class NeedBluetoothTurnedOn extends OneKeyHardwareError {
  override key: LocaleIds = 'msg__hardware_bluetooth_need_turned_on_error';
}

// 没有使用蓝牙的权限
export class NeedBluetoothPermissions extends OneKeyHardwareError {
  override key: LocaleIds = 'msg__hardware_bluetooth_requires_permission_error';
}

export class DeviceNotFind extends OneKeyHardwareError {
  override reconnect = true;

  override key: LocaleIds = 'msg__hardware_device_not_find_error';
}

export class InitIframeLoadFail extends OneKeyHardwareError {
  override reconnect = true;

  override key: LocaleIds = 'msg__hardware_init_iframe_load_error';
}

export class InitIframeTimeout extends OneKeyHardwareError {
  override reconnect = true;

  override key: LocaleIds = 'msg__hardware_init_iframe_load_error';
}

// 未知错误
export class UnknownHardwareError extends OneKeyHardwareError {
  override reconnect = true;
}
