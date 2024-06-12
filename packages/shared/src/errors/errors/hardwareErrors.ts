/* eslint-disable max-classes-per-file */
import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { EAppEventBusNames, appEventBus } from '../../eventBus/appEventBus';
import { ETranslations } from '../../locale';
import {
  ECustomOneKeyHardwareError,
  EOneKeyErrorClassNames,
} from '../types/errorTypes';
import { normalizeErrorProps } from '../utils/errorUtils';

import { OneKeyError } from './baseErrors';

import type {
  IOneKeyError,
  IOneKeyErrorI18nInfo,
  IOneKeyHardwareErrorPayload,
  IOneKeyJsError,
} from '../types/errorTypes';

export type IOneKeyErrorHardwareProps = Omit<IOneKeyError, 'payload'> & {
  payload: IOneKeyHardwareErrorPayload; // raw payload from hardware sdk error response
};
export class OneKeyHardwareError<
  I18nInfoT = IOneKeyErrorI18nInfo | any,
  DataT = IOneKeyJsError | any,
> extends OneKeyError<I18nInfoT, DataT> {
  override className = EOneKeyErrorClassNames.OneKeyHardwareError;

  $isHardwareError = true;

  reconnect: boolean | undefined; // TODO move to $$config
}

export class InvalidPIN extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'HardwareInvalidPIN',
        defaultKey: ETranslations.enter_pin_invalid_pin,
        defaultAutoToast: true,
      }),
    );
  }

  override code = HardwareErrorCode.PinInvalid;

  // override key: ETranslations = 'msg__hardware_invalid_pin_error';
}

export class InvalidPassphrase extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'InvalidPassphrase',
        defaultKey: 'msg__hardware_device_passphrase_state_error',
      }),
    );
  }

  override code = HardwareErrorCode.DeviceCheckPassphraseStateError;
}

export class DeviceNotOpenedPassphrase extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'DeviceNotOpenedPassphrase',
        defaultKey: 'msg__hardware_not_opened_passphrase',
        defaultAutoToast: true,
      }),
    );
  }

  override code = HardwareErrorCode.DeviceNotOpenedPassphrase;
}

export class DeviceOpenedPassphrase extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'DeviceOpenedPassphrase',
        defaultKey: 'msg__hardware_opened_passphrase',
      }),
    );
  }

  override code = HardwareErrorCode.DeviceOpenedPassphrase;
}

export class UserCancel extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'UserCancel',
        defaultKey: ETranslations.global_cancel_confirm_on_device_feedback,
        // defaultAutoToast: true,
      }),
    );
  }

  override code = HardwareErrorCode.ActionCancelled;
}

export class UserCancelFromOutside extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'UserCancelFromOutside',
        defaultKey: ETranslations.global_cancel_confirm_on_device_feedback,
        // defaultAutoToast: true,
      }),
    );
  }

  override code = HardwareErrorCode.DeviceInterruptedFromOutside;
}

export class UnknownMethod extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'UnknownMethod',
        defaultKey: 'msg__hardware_unknown_message_error',
      }),
    );
  }

  override code = HardwareErrorCode.RuntimeError;
}

export class NeedOneKeyBridge extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'NeedOneKeyBridge',
        defaultKey: ETranslations.onboarding_install_onekey_bridge_help_text,
      }),
    );
  }

  override code = ECustomOneKeyHardwareError.NeedOneKeyBridge;
}

export class NeedOneKeyBridgeUpgrade extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'NeedOneKeyBridgeUpgrade',
      }),
    );
  }

  override code = ECustomOneKeyHardwareError.NeedOneKeyBridgeUpgrade;
}

export class NeedFirmwareUpgradeFromWeb extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'NeedFirmwareUpgradeFromWeb',
      }),
    );
  }

  override code = ECustomOneKeyHardwareError.NeedFirmwareUpgradeFromWeb;
}

export class FirmwareUpdateBatteryTooLow extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultKey: ETranslations.update_insufficient_battery_power,
      }),
    );
  }

  override code = ECustomOneKeyHardwareError.FirmwareUpdateBatteryTooLow;
}

export class BridgeNetworkError extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'BridgeNetworkError',
        defaultKey: ETranslations.update_bridge_network_error,
      }),
    );
  }

  override code = HardwareErrorCode.BridgeNetworkError;
}

export class BridgeTimeoutError extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'BridgeTimeoutError',
        defaultKey: ETranslations.update_bridge_timeout_error,
      }),
    );
  }

  override code = HardwareErrorCode.BridgeTimeoutError;
}

export class BridgeTimeoutErrorForDesktop extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'BridgeTimeoutErrorForDesktop',
        defaultKey: ETranslations.global_connection_failed_usb_help_text,
      }),
    );
  }

  override code = HardwareErrorCode.BridgeTimeoutError;
}

export class ConnectTimeoutError extends OneKeyHardwareError {
  // defaultKey: 'msg__hardware_connect_timeout_error',
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'ConnectTimeoutError',
        defaultKey: ETranslations.global_connection_failed_help_text,
        // defaultAutoToast: true,
      }),
    );
  }

  override code = HardwareErrorCode.PollingTimeout;
}

export class DeviceMethodCallTimeout extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'DeviceMethodCallTimeout',
      }),
    );
  }

  override code = ECustomOneKeyHardwareError.DeviceMethodCallTimeout;
}

export class ConnectPollingStopError extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'ConnectPollingStopError',
        defaultKey: ETranslations.feedback_hw_polling_time_out,
        // defaultAutoToast: true,
      }),
    );
  }

  override code = HardwareErrorCode.PollingStop;
}

// 设备没有配对成功
export class DeviceNotBonded extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'DeviceNotBonded',
        defaultKey: ETranslations.feedback_bluetooth_unparied,
      }),
    );
  }

  override code = HardwareErrorCode.BleDeviceNotBonded;
}

// 设备配对失败
export class DeviceBondError extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'DeviceBondError',
        defaultKey: ETranslations.feedback_bluetooth_pairing_failed,
      }),
    );
  }

  override code = HardwareErrorCode.BleDeviceBondError;
}

// 设备没有打开蓝牙
export class NeedBluetoothTurnedOn extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'NeedBluetoothTurnedOn',
        defaultKey: 'msg__hardware_bluetooth_need_turned_on_error',
      }),
    );
  }

  override code = HardwareErrorCode.BlePermissionError;
}

// 没有使用蓝牙的权限
export class NeedBluetoothPermissions extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'NeedBluetoothPermissions',
        defaultKey: 'msg__hardware_bluetooth_requires_permission_error',
      }),
    );
  }

  override code = HardwareErrorCode.BleLocationError;
}

export class BleLocationServiceError extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'BleLocationServiceError',
        defaultKey: 'msg__hardware_device_ble_location_disabled',
      }),
    );
  }

  override code = HardwareErrorCode.BleLocationServicesDisabled;
}

export class BleWriteCharacteristicError extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'BleWriteCharacteristicError',
        defaultKey: 'msg__hardware_device_need_restart',
      }),
    );
  }

  override code = HardwareErrorCode.BleWriteCharacteristicError;
}

export class BleScanError extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'BleScanError',
        defaultKey: 'msg__hardware_device_ble_scan_error',
      }),
    );
  }

  override code = HardwareErrorCode.BleScanError;
}

export class BleAlreadyConnectedError extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'BleAlreadyConnectedError',
        defaultKey: 'msg__hardware_device_ble_already_connected',
      }),
    );
  }

  override code = HardwareErrorCode.BleAlreadyConnected;
}

export class OpenBlindSign extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'OpenBlindSign',
        defaultKey: 'msg__hardware_open_blind_sign_error',
      }),
    );
  }

  override code = HardwareErrorCode.BlindSignDisabled;
}

export class FirmwareVersionTooLow extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'FirmwareVersionTooLow',
        defaultKey: 'msg__hardware_version_need_upgrade_error',
      }),
    );
  }

  override code = HardwareErrorCode.CallMethodNeedUpgradeFirmware;

  // constructor(errorPayload?: IOneKeyHardwareErrorPayload) {
  //   super(errorPayload, { 0: 'require' });
  // }
}

export class NotInBootLoaderMode extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'NotInBootLoaderMode',
      }),
    );

    if (props?.payload?.connectId) {
      appEventBus.emit(EAppEventBusNames.ShowFirmwareUpdateFromBootloaderMode, {
        connectId: props?.payload?.connectId,
      });
    }
  }

  override code = HardwareErrorCode.DeviceUnexpectedBootloaderMode;
}

export class DeviceDetectInBootloaderMode extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'DeviceDetectInBootloaderMode',
      }),
    );
  }

  override code = HardwareErrorCode.DeviceDetectInBootloaderMode;
}

export class FirmwareDownloadFailed extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'FirmwareDownloadFailed',
        defaultKey: 'msg__hardware_firmware_download_error',
      }),
    );
  }

  override code = HardwareErrorCode.FirmwareUpdateDownloadFailed;

  override reconnect = true;
}

export class FirmwareUpdateManuallyEnterBoot extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      // You need to manually enter boot.
      normalizeErrorProps(props, {
        defaultMessage: 'FirmwareUpdateManuallyEnterBoot',
        defaultKey: 'msg__hardware_manually_enter_boot',
        defaultAutoToast: true,
      }),
    );
  }

  override code = HardwareErrorCode.FirmwareUpdateManuallyEnterBoot;

  override reconnect = true;
}

export class FirmwareUpdateAutoEnterBootFailure extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'FirmwareUpdateAutoEnterBootFailure',
        defaultKey: 'msg__hardware_enter_boot_failure',
      }),
    );
  }

  override code = HardwareErrorCode.FirmwareUpdateAutoEnterBootFailure;

  override reconnect = true;
}

export class FirmwareUpdateLimitOneDevice extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'FirmwareUpdateLimitOneDevice',
        defaultKey: 'modal__only_one_device_can_be_connected_desc',
      }),
    );
  }

  override code = HardwareErrorCode.FirmwareUpdateLimitOneDevice;

  // TODO
  override reconnect = true;
}

export class UseDesktopToUpdateFirmware extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'UseDesktopToUpdateFirmware',
      }),
    );
  }

  override code = HardwareErrorCode.UseDesktopToUpdateFirmware;
}

export class NewFirmwareUnRelease extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'NewFirmwareUnRelease',
        defaultKey: 'msg__str_not_supported_by_hardware_wallets',
      }),
    );
  }

  override code = HardwareErrorCode.NewFirmwareUnRelease;

  // TODO
  override reconnect = true;
}

export class NewFirmwareForceUpdate extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'NewFirmwareForceUpdate',
        defaultKey: 'msg__need_force_upgrade_firmware',
      }),
    );
  }

  override code = HardwareErrorCode.NewFirmwareForceUpdate;
}

export class DeviceNotSame extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'DeviceNotSame',
        defaultKey:
          'msg__device_information_is_inconsistent_it_may_caused_by_device_reset',
      }),
    );
  }

  override code = HardwareErrorCode.DeviceCheckDeviceIdError;
}

export class DeviceNotFound extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    // props?.message
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'DeviceNotFound',
        defaultKey: 'msg__hardware_device_not_find_error',
        defaultAutoToast: false, // do not auto toast for DeviceNotFound, it's very common for silence call getFeatures
      }),
    );
  }

  override code = HardwareErrorCode.DeviceNotFound;

  // TODO remove? convertDeviceError should update data by payload
  override reconnect = true;
}

export class InitIframeLoadFail extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      // Hardware SDK initialization failed. Please check your network or switch the proxy then try again.
      normalizeErrorProps(props, {
        defaultMessage: 'InitIframeLoadFail',
        defaultKey: ETranslations.global_network_error_help_text,
        defaultAutoToast: true,
      }),
    );
  }

  override code = HardwareErrorCode.IFrameLoadFail;
}

export class InitIframeTimeout extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'InitIframeTimeout',
        defaultKey: ETranslations.global_network_error_help_text,
      }),
    );
  }

  override code = HardwareErrorCode.IframeTimeout;
}

export class NetworkError extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'NetworkError',
        defaultKey: 'title__no_connection_desc',
      }),
    );
  }

  override code = HardwareErrorCode.NetworkError;

  override reconnect = true;
}

export class NotSupportPassphraseError extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'NotSupportPassphraseError',
        defaultKey: 'msg__not_support_passphrase_need_upgrade',
      }),
    );
  }

  override code = HardwareErrorCode.DeviceNotSupportPassphrase;

  // TODO use Passphrase, need to upgrade firmware to {0} or later.
  // constructor(errorPayload?: IOneKeyHardwareErrorPayload) {
  //   super(errorPayload, { 0: 'require' });
  // }
}

export class FileAlreadyExistError extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'FileAlreadyExistError',
        defaultKey: 'msg__file_already_exists',
      }),
    );
  }

  override code = HardwareErrorCode.FileAlreadyExists;
}

export class IncompleteFileError extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'IncompleteFileError',
        defaultKey: 'msg__incomplete_file',
      }),
    );
  }

  override code = HardwareErrorCode.CheckDownloadFileError;
}

export class NotInSigningModeError extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'NotInSigningModeError',
        defaultKey: 'msg__transaction_signing_error_not_in_signing_mode',
      }),
    );
  }

  override code = HardwareErrorCode.NotInSigningMode;
}

// UnknownHardware
export class UnknownHardwareError extends OneKeyHardwareError {
  override className: EOneKeyErrorClassNames =
    EOneKeyErrorClassNames.UnknownHardwareError;

  constructor(props?: IOneKeyErrorHardwareProps) {
    const message = [
      props?.payload?.error,
      props?.payload?.message, // use device raw error message as UnknownHardwareError message
      props?.message,
      props?.payload?.code,
    ]
      .filter(Boolean)
      .join(' : ');
    super(
      normalizeErrorProps(props, {
        defaultMessage: message || 'Unknown Hardware Error',
        defaultKey: ETranslations.feedback_request_failed,
        alwaysAppendDefaultMessage: true,
        // defaultAutoToast: true,
      }),
    );
  }
}

// TODO
// super(errorPayload, { 0: 'require' });
// override data = { reconnect: true }; // TODO merge with autoToast to config={ autoToast, reconnect }

// export class OneKeyAlreadyExistWalletError extends OneKeyHardwareError<
//   {
//     walletId: string;
//     walletName: string | undefined;
//   } & OneKeyHardwareErrorData
// > {
//   override className = OneKeyErrorClassNames.OneKeyAlreadyExistWalletError;

//   override key: LocaleIds = 'msg__wallet_already_exist';

//   constructor(walletId: string, walletName: string | undefined) {
//     super(undefined, undefined, { walletId, walletName });
//   }
// }
