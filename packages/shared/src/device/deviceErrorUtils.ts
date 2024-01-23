import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import type { OneKeyHardwareError } from '@onekeyhq/engine/src/errors';
import * as Error from '@onekeyhq/kit/src/utils/hardware/errors';

import debugLogger from '../logger/debugLogger';
import platformEnv from '../platformEnv';

function caputureSpecialError(code: number, message: string) {
  if (typeof message !== 'string') return null;
  if (
    code === HardwareErrorCode.DeviceInitializeFailed &&
    message.includes('ECONNABORTED')
  ) {
    return new Error.ConnectTimeoutError({ message });
  }
  if (message.includes('Bridge network error')) {
    return new Error.BridgeNetworkError({ message });
  }
  return null;
}

export function convertDeviceError(payload: any): OneKeyHardwareError {
  // handle ext error
  const {
    code,
    error,
    message,
  }: {
    code: number;
    error?: string;
    message?: string;
  } = payload || {};

  const msg = error ?? message ?? 'Unknown error';

  /**
   * Catch some special errors
   * they may have multiple error codes
   */
  if (caputureSpecialError(code, msg)) {
    return caputureSpecialError(code, msg) as Error.ConnectTimeoutError;
  }

  debugLogger.hardwareSDK.info('Device Utils Convert Device Error:', code, msg);

  switch (code) {
    case HardwareErrorCode.UnknownError:
      return new Error.UnknownHardwareError(payload);
    case HardwareErrorCode.DeviceFwException:
      return new Error.FirmwareVersionTooLow(payload);
    case HardwareErrorCode.DeviceUnexpectedMode:
      if (
        typeof msg === 'string' &&
        msg.indexOf('ui-device_bootloader_mode') !== -1
      ) {
        return new Error.NotInBootLoaderMode(payload);
      }
      return new Error.UnknownHardwareError(payload);
    case HardwareErrorCode.DeviceCheckDeviceIdError:
      return new Error.DeviceNotSame(payload);
    case HardwareErrorCode.DeviceNotFound:
      return new Error.DeviceNotFind(payload);
    case HardwareErrorCode.DeviceUnexpectedBootloaderMode:
      return new Error.NotInBootLoaderMode(payload);
    case HardwareErrorCode.DeviceInterruptedFromOutside:
      return new Error.UserCancelFromOutside(payload);
    case HardwareErrorCode.DeviceInterruptedFromUser:
      return new Error.UserCancelFromOutside(payload);
    case HardwareErrorCode.DeviceNotSupportPassphrase:
      return new Error.NotSupportPassphraseError(payload);
    case HardwareErrorCode.IFrameLoadFail:
      return new Error.InitIframeLoadFail(payload);
    case HardwareErrorCode.IframeTimeout:
      return new Error.InitIframeTimeout(payload);
    case HardwareErrorCode.FirmwareUpdateDownloadFailed:
      return new Error.FirmwareDownloadFailed(payload);
    case HardwareErrorCode.FirmwareUpdateManuallyEnterBoot:
      return new Error.FirmwareUpdateManuallyEnterBoot(payload);
    case HardwareErrorCode.FirmwareUpdateAutoEnterBootFailure:
      return new Error.FirmwareUpdateAutoEnterBootFailure(payload);
    case HardwareErrorCode.FirmwareUpdateLimitOneDevice:
      return new Error.FirmwareUpdateLimitOneDevice(payload);
    case HardwareErrorCode.CallMethodNeedUpgradeFirmware:
      return new Error.FirmwareVersionTooLow(payload);
    case HardwareErrorCode.NewFirmwareUnRelease:
      return new Error.NewFirmwareUnRelease(payload);
    case HardwareErrorCode.NewFirmwareForceUpdate:
      return new Error.NewFirmwareForceUpdate(payload);
    case HardwareErrorCode.NetworkError:
      return new Error.NetworkError(payload);
    case HardwareErrorCode.BlePermissionError:
      return new Error.NeedBluetoothTurnedOn(payload);
    case HardwareErrorCode.BleLocationError:
      return new Error.NeedBluetoothPermissions({ message: msg });
    case HardwareErrorCode.BleLocationServicesDisabled:
      return new Error.BleLocationServiceError({ message: msg });
    case HardwareErrorCode.BleDeviceNotBonded:
      return new Error.DeviceNotBonded(payload);
    case HardwareErrorCode.BleDeviceBondError:
      return new Error.DeviceBondError(payload);
    case HardwareErrorCode.BleWriteCharacteristicError:
      return new Error.BleWriteCharacteristicError(payload);
    case HardwareErrorCode.BleScanError:
      return new Error.BleScanError({ message: msg });
    case HardwareErrorCode.BleAlreadyConnected:
      return new Error.BleAlreadyConnectedError(payload);
    case HardwareErrorCode.RuntimeError:
      if (msg.indexOf('EIP712 blind sign is disabled') !== -1) {
        return new Error.OpenBlindSign(payload);
      }
      if (msg.indexOf('Unknown message') !== -1) {
        return new Error.UnknownMethod(payload);
      }
      if (msg.indexOf('Failure_UnexpectedMessage') !== -1) {
        return new Error.UnknownMethod(payload);
      }
      return new Error.UnknownHardwareError(payload);
    case HardwareErrorCode.PinInvalid:
      return new Error.InvalidPIN(payload);
    case HardwareErrorCode.DeviceCheckPassphraseStateError:
      return new Error.InvalidPassphrase(payload);
    case HardwareErrorCode.DeviceOpenedPassphrase:
      return new Error.DeviceOpenedPassphrase(payload);
    case HardwareErrorCode.DeviceNotOpenedPassphrase:
      return new Error.DeviceNotOpenedPassphrase(payload);
    case HardwareErrorCode.PinCancelled:
    case HardwareErrorCode.ActionCancelled:
      return new Error.UserCancel(payload);
    case HardwareErrorCode.BridgeNotInstalled:
      return new Error.NeedOneKeyBridge(payload);
    case Error.CustomOneKeyHardwareError.NeedOneKeyBridge:
      return new Error.NeedOneKeyBridge(payload);
    case HardwareErrorCode.BridgeNetworkError:
      return new Error.BridgeNetworkError(payload);
    case HardwareErrorCode.BridgeTimeoutError:
      if (platformEnv.isDesktop) {
        debugLogger.hardwareSDK.debug(
          'desktop bridge timeout, restart desktop bridge.',
        );
        window.desktopApi.reloadBridgeProcess();
      }
      return new Error.BridgeTimeoutError(payload);
    case HardwareErrorCode.PollingTimeout:
      return new Error.ConnectTimeoutError(payload);
    case HardwareErrorCode.PollingStop:
      return new Error.ConnectPollingStopError(payload);
    case HardwareErrorCode.BlindSignDisabled:
      return new Error.OpenBlindSign(payload);
    case HardwareErrorCode.FileAlreadyExists:
      return new Error.FileAlreadyExistError(payload);
    case HardwareErrorCode.CheckDownloadFileError:
      return new Error.IncompleteFileError(payload);
    case HardwareErrorCode.NotInSigningMode:
      return new Error.NotInSigningModeError(payload);
    case HardwareErrorCode.DataOverload:
      return new Error.DeviceDataOverload(payload);
    default:
      return new Error.UnknownHardwareError(payload);
  }
}
