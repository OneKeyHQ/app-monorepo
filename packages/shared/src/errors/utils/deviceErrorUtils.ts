import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import platformEnv from '../../platformEnv';
import * as HardwareErrors from '../errors/hardwareErrors';
import {
  ECustomOneKeyHardwareError,
  type OneKeyHardwareError,
} from '../errors/hardwareErrors';

function captureSpecialError(code: number, message: string) {
  if (typeof message !== 'string') return null;
  if (
    code === HardwareErrorCode.DeviceInitializeFailed &&
    message.includes('ECONNABORTED')
  ) {
    return new HardwareErrors.ConnectTimeoutError({ message });
  }
  if (message.includes('Bridge network error')) {
    return new HardwareErrors.BridgeNetworkError({ message });
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
  if (captureSpecialError(code, msg)) {
    return captureSpecialError(code, msg) as HardwareErrors.ConnectTimeoutError;
  }

  switch (code) {
    case HardwareErrorCode.UnknownError:
      return new HardwareErrors.UnknownHardwareError(payload);
    case HardwareErrorCode.DeviceFwException:
      return new HardwareErrors.FirmwareVersionTooLow(payload);
    case HardwareErrorCode.DeviceUnexpectedMode:
      if (
        typeof msg === 'string' &&
        msg.indexOf('ui-device_bootloader_mode') !== -1
      ) {
        return new HardwareErrors.NotInBootLoaderMode(payload);
      }
      return new HardwareErrors.UnknownHardwareError(payload);
    case HardwareErrorCode.DeviceCheckDeviceIdError:
      return new HardwareErrors.DeviceNotSame(payload);
    case HardwareErrorCode.DeviceNotFound:
      return new HardwareErrors.DeviceNotFind(payload);
    case HardwareErrorCode.DeviceUnexpectedBootloaderMode:
      return new HardwareErrors.NotInBootLoaderMode(payload);
    case HardwareErrorCode.DeviceInterruptedFromOutside:
      return new HardwareErrors.UserCancelFromOutside(payload);
    case HardwareErrorCode.DeviceInterruptedFromUser:
      return new HardwareErrors.UserCancelFromOutside(payload);
    case HardwareErrorCode.DeviceNotSupportPassphrase:
      return new HardwareErrors.NotSupportPassphraseError(payload);
    case HardwareErrorCode.IFrameLoadFail:
      return new HardwareErrors.InitIframeLoadFail(payload);
    case HardwareErrorCode.IframeTimeout:
      return new HardwareErrors.InitIframeTimeout(payload);
    case HardwareErrorCode.FirmwareUpdateDownloadFailed:
      return new HardwareErrors.FirmwareDownloadFailed(payload);
    case HardwareErrorCode.FirmwareUpdateManuallyEnterBoot:
      return new HardwareErrors.FirmwareUpdateManuallyEnterBoot(payload);
    case HardwareErrorCode.FirmwareUpdateAutoEnterBootFailure:
      return new HardwareErrors.FirmwareUpdateAutoEnterBootFailure(payload);
    case HardwareErrorCode.FirmwareUpdateLimitOneDevice:
      return new HardwareErrors.FirmwareUpdateLimitOneDevice(payload);
    case HardwareErrorCode.CallMethodNeedUpgradeFirmware:
      return new HardwareErrors.FirmwareVersionTooLow(payload);
    case HardwareErrorCode.NewFirmwareUnRelease:
      return new HardwareErrors.NewFirmwareUnRelease(payload);
    case HardwareErrorCode.NewFirmwareForceUpdate:
      return new HardwareErrors.NewFirmwareForceUpdate(payload);
    case HardwareErrorCode.NetworkError:
      return new HardwareErrors.NetworkError(payload);
    case HardwareErrorCode.BlePermissionError:
      return new HardwareErrors.NeedBluetoothTurnedOn(payload);
    case HardwareErrorCode.BleLocationError:
      return new HardwareErrors.NeedBluetoothPermissions({ message: msg });
    case HardwareErrorCode.BleLocationServicesDisabled:
      return new HardwareErrors.BleLocationServiceError({ message: msg });
    case HardwareErrorCode.BleDeviceNotBonded:
      return new HardwareErrors.DeviceNotBonded(payload);
    case HardwareErrorCode.BleDeviceBondError:
      return new HardwareErrors.DeviceBondError(payload);
    case HardwareErrorCode.BleWriteCharacteristicError:
      return new HardwareErrors.BleWriteCharacteristicError(payload);
    case HardwareErrorCode.BleScanError:
      return new HardwareErrors.BleScanError({ message: msg });
    case HardwareErrorCode.BleAlreadyConnected:
      return new HardwareErrors.BleAlreadyConnectedError(payload);
    case HardwareErrorCode.RuntimeError:
      if (msg.indexOf('EIP712 blind sign is disabled') !== -1) {
        return new HardwareErrors.OpenBlindSign(payload);
      }
      if (msg.indexOf('Unknown message') !== -1) {
        return new HardwareErrors.UnknownMethod(payload);
      }
      if (msg.indexOf('Failure_UnexpectedMessage') !== -1) {
        return new HardwareErrors.UnknownMethod(payload);
      }
      return new HardwareErrors.UnknownHardwareError(payload);
    case HardwareErrorCode.PinInvalid:
      return new HardwareErrors.InvalidPIN(payload);
    case HardwareErrorCode.DeviceCheckPassphraseStateError:
      return new HardwareErrors.InvalidPassphrase(payload);
    case HardwareErrorCode.DeviceOpenedPassphrase:
      return new HardwareErrors.DeviceOpenedPassphrase(payload);
    case HardwareErrorCode.DeviceNotOpenedPassphrase:
      return new HardwareErrors.DeviceNotOpenedPassphrase(payload);
    case HardwareErrorCode.PinCancelled:
    case HardwareErrorCode.ActionCancelled:
      return new HardwareErrors.UserCancel(payload);
    case HardwareErrorCode.BridgeNotInstalled:
      return new HardwareErrors.NeedOneKeyBridge(payload);
    case ECustomOneKeyHardwareError.NeedOneKeyBridge:
      return new HardwareErrors.NeedOneKeyBridge(payload);
    case HardwareErrorCode.BridgeNetworkError:
      return new HardwareErrors.BridgeNetworkError(payload);
    case HardwareErrorCode.BridgeTimeoutError:
      if (platformEnv.isDesktop) {
        window.desktopApi.reloadBridgeProcess();
      }
      return new HardwareErrors.BridgeTimeoutError(payload);
    case HardwareErrorCode.PollingTimeout:
      return new HardwareErrors.ConnectTimeoutError(payload);
    case HardwareErrorCode.PollingStop:
      return new HardwareErrors.ConnectPollingStopError(payload);
    case HardwareErrorCode.BlindSignDisabled:
      return new HardwareErrors.OpenBlindSign(payload);
    case HardwareErrorCode.FileAlreadyExists:
      return new HardwareErrors.FileAlreadyExistError(payload);
    case HardwareErrorCode.CheckDownloadFileError:
      return new HardwareErrors.IncompleteFileError(payload);
    case HardwareErrorCode.NotInSigningMode:
      return new HardwareErrors.NotInSigningModeError(payload);
    default:
      return new HardwareErrors.UnknownHardwareError(payload);
  }
}
