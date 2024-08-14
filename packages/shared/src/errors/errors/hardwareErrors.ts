/* eslint-disable max-classes-per-file */
import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { get, uniq } from 'lodash';

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
        defaultKey: ETranslations.hardware_device_passphrase_state_error,
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
        defaultKey: ETranslations.hardware_not_opened_passphrase,
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
        defaultKey: ETranslations.hardware_opened_passphrase,
      }),
    );
  }

  override code = HardwareErrorCode.DeviceOpenedPassphrase;
}

export class PinCancelled extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'PinCancelled',
        defaultKey: ETranslations.feedback_pin_verification_cancelled,
        // defaultAutoToast: true,
      }),
    );
  }

  override code = HardwareErrorCode.PinCancelled;
}

export class UserCancel extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'UserCancel',
        defaultKey: ETranslations.hardware_user_cancel_error,
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
        defaultKey: ETranslations.hardware_user_cancel_error,
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
        defaultKey: ETranslations.hardware_unknown_message_error,
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
        defaultKey: ETranslations.hardware_bluetooth_need_turned_on_error,
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
        defaultKey: ETranslations.hardware_bluetooth_requires_permission_error,
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
        defaultKey: ETranslations.hardware_device_ble_location_disabled,
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
        defaultKey: ETranslations.hardware_device_need_restart,
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
        defaultKey: ETranslations.hardware_device_ble_scan_error,
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
        defaultKey: ETranslations.hardware_device_ble_already_connected,
      }),
    );
  }

  override code = HardwareErrorCode.BleAlreadyConnected;
}

export class BleCharacteristicNotifyChangeFailure extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'BleCharacteristicNotifyChangeFailure',
        defaultKey: ETranslations.feedback_bluetooth_issue,
      }),
    );
  }

  override code = HardwareErrorCode.BleCharacteristicNotifyChangeFailure;
}

export class OpenBlindSign extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'OpenBlindSign',
        defaultKey: ETranslations.hardware_open_blind_sign_error,
      }),
    );
  }

  override code = HardwareErrorCode.BlindSignDisabled;
}

export class ForbiddenKeyPathError extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'ForbiddenKeyPath',
        defaultKey: ETranslations.feedback_forbidden_key_path_error,
      }),
    );
  }

  override code = HardwareErrorCode.RuntimeError;
}

export class StringOverflowError extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'StringOverflowError',
        defaultKey: ETranslations.global_hardware_name_input_max,
      }),
    );
  }

  override code = HardwareErrorCode.RuntimeError;
}

export class FirmwareVersionTooLow extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(
        {
          info: { 'version': get(props, 'payload.params.require', '') },
        },
        {
          defaultMessage: 'FirmwareVersionTooLow',
          defaultKey: ETranslations.hardware_version_need_upgrade_error,
        },
      ),
    );
  }

  override code = HardwareErrorCode.CallMethodNeedUpgradeFirmware;

  // constructor(errorPayload?: IOneKeyHardwareErrorPayload) {
  //   super(errorPayload, { 0: 'require' });
  // }
}

export class DeviceInitializeFailed extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'DeviceInitializeFailed',
        defaultKey: ETranslations.hardware_connect_timeout_error,
        // defaultAutoToast: true,
      }),
    );
  }

  override code = HardwareErrorCode.DeviceInitializeFailed;
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
        defaultKey: ETranslations.hardware_firmware_download_error,
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
        defaultKey: ETranslations.hardware_manually_enter_boot,
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
        defaultKey: ETranslations.hardware_enter_boot_failure,
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
        defaultKey:
          ETranslations.hardware_only_one_device_can_be_connected_desc,
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
        defaultKey:
          ETranslations.hardware_str_not_supported_by_hardware_wallets,
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
        defaultKey: ETranslations.hardware_need_force_upgrade_firmware,
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
          ETranslations.hardware_device_information_is_inconsistent_it_may_caused_by_device_reset,
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
        defaultKey: ETranslations.hardware_device_not_find_error,
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
        defaultKey: ETranslations.hardware_no_connection_desc,
      }),
    );
  }

  override code = HardwareErrorCode.NetworkError;

  override reconnect = true;
}

export class NotSupportPassphraseError extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(
        {
          info: { 'version': get(props, 'payload.params.require', '') },
        },
        {
          defaultMessage: 'NotSupportPassphraseError',
          defaultKey:
            ETranslations.hardware_not_support_passphrase_need_upgrade,
        },
      ),
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
        defaultKey: ETranslations.hardware_file_already_exists,
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
        defaultKey: ETranslations.hardware_incomplete_file,
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
        defaultKey:
          ETranslations.hardware_transaction_signing_error_not_in_signing_mode,
      }),
    );
  }

  override code = HardwareErrorCode.NotInSigningMode;
}

export class DeviceDataOverload extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'DataOverloadError',
        defaultKey: ETranslations.hardware_hardware_params_bytes_overload,
      }),
    );
  }

  override code = HardwareErrorCode.DataOverload;
}

export class UnsupportedAddressTypeError extends OneKeyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'UnsupportedAddressTypeError',
        defaultKey:
          ETranslations.feedback_hardware_unsupported_current_address_type,
      }),
    );
  }

  override code = HardwareErrorCode.RuntimeError;
}

// Communication exception 通信异常
export class HardwareCommunicationError extends OneKeyHardwareError {
  override className: EOneKeyErrorClassNames =
    EOneKeyErrorClassNames.UnknownHardwareError;

  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'CommunicationError',
        defaultKey: ETranslations.hardware_device_need_restart,
      }),
    );
  }
}

// UnknownHardware
export class UnknownHardwareError extends OneKeyHardwareError {
  override className: EOneKeyErrorClassNames =
    EOneKeyErrorClassNames.UnknownHardwareError;

  constructor(props?: IOneKeyErrorHardwareProps) {
    const message = uniq([
      props?.payload?.error,
      props?.payload?.message, // use device raw error message as UnknownHardwareError message
      props?.message,
      props?.payload?.code,
    ])
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
