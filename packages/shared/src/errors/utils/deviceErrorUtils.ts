import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { isArray, isNil } from 'lodash';

import platformEnv from '../../platformEnv';
import * as HardwareErrors from '../errors/hardwareErrors';
import {
  ECustomOneKeyHardwareError,
  EOneKeyErrorClassNames,
} from '../types/errorTypes';

import { getDeviceErrorPayloadMessage } from './errorUtils';

import type { IDeviceResponseResult } from '../../../types/device';
import type {
  IOneKeyError,
  IOneKeyHardwareErrorPayload,
} from '../types/errorTypes';

export function captureSpecialError(
  code: string | number | undefined,
  message: string,
) {
  if (typeof message !== 'string') return null;
  if (
    Number(code) === HardwareErrorCode.DeviceInitializeFailed &&
    message.includes('ECONNABORTED')
  ) {
    return new HardwareErrors.ConnectTimeoutError({
      payload: undefined as any,
      message,
    });
  }
  if (message.includes('Bridge network error')) {
    return new HardwareErrors.BridgeNetworkError({
      payload: undefined as any,
      message,
    });
  }
  return null;
}

export function convertDeviceError(
  payloadOrigin: IOneKeyHardwareErrorPayload,
): IOneKeyError {
  const payload = {
    ...payloadOrigin,
    message: getDeviceErrorPayloadMessage(payloadOrigin),
  };
  const { code, message, params } = payload;

  // TODO convert hardware error payload params to OneKeyError i18n info
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const info = params;

  const specialError = captureSpecialError(code, message);
  /**
   * Catch some special errors
   * they may have multiple error codes
   */
  if (specialError) {
    // return specialError as HardwareErrors.ConnectTimeoutError;
    return specialError;
  }

  // TODO replace sdk HardwareErrorCode to enum
  switch (code) {
    case HardwareErrorCode.UnknownError:
      return new HardwareErrors.UnknownHardwareError({ payload });
    case HardwareErrorCode.DeviceFwException:
      return new HardwareErrors.FirmwareVersionTooLow({ payload });
    case HardwareErrorCode.DeviceUnexpectedMode:
      if (
        typeof message === 'string' &&
        message.indexOf('ui-device_bootloader_mode') !== -1
      ) {
        return new HardwareErrors.NotInBootLoaderMode({ payload });
      }
      return new HardwareErrors.UnknownHardwareError({ payload });
    case HardwareErrorCode.DeviceCheckDeviceIdError:
      return new HardwareErrors.DeviceNotSame({ payload });
    case HardwareErrorCode.DeviceNotFound:
      return new HardwareErrors.DeviceNotFound({ payload });
    case HardwareErrorCode.DeviceInitializeFailed:
      return new HardwareErrors.DeviceInitializeFailed({ payload });
    case HardwareErrorCode.DeviceUnexpectedBootloaderMode:
      return new HardwareErrors.NotInBootLoaderMode({ payload });
    case HardwareErrorCode.DeviceDetectInBootloaderMode:
      return new HardwareErrors.DeviceDetectInBootloaderMode({ payload });
    case HardwareErrorCode.DeviceInterruptedFromOutside:
      return new HardwareErrors.UserCancelFromOutside({ payload });
    case HardwareErrorCode.DeviceInterruptedFromUser:
      return new HardwareErrors.UserCancelFromOutside({ payload });
    case HardwareErrorCode.DeviceNotSupportPassphrase:
      return new HardwareErrors.NotSupportPassphraseError({ payload });
    case HardwareErrorCode.IFrameLoadFail:
      return new HardwareErrors.InitIframeLoadFail({ payload });
    case HardwareErrorCode.IframeTimeout:
      return new HardwareErrors.InitIframeTimeout({ payload });
    case HardwareErrorCode.FirmwareUpdateDownloadFailed:
      return new HardwareErrors.FirmwareDownloadFailed({ payload });
    case HardwareErrorCode.FirmwareUpdateManuallyEnterBoot:
      return new HardwareErrors.FirmwareUpdateManuallyEnterBoot({ payload });
    case HardwareErrorCode.FirmwareUpdateAutoEnterBootFailure:
      return new HardwareErrors.FirmwareUpdateAutoEnterBootFailure({ payload });
    case HardwareErrorCode.FirmwareUpdateLimitOneDevice:
      return new HardwareErrors.FirmwareUpdateLimitOneDevice({ payload });
    case HardwareErrorCode.UseDesktopToUpdateFirmware:
      return new HardwareErrors.UseDesktopToUpdateFirmware({ payload });
    case HardwareErrorCode.CallMethodNeedUpgradeFirmware:
      return new HardwareErrors.FirmwareVersionTooLow({ payload });
    case HardwareErrorCode.NewFirmwareUnRelease:
      return new HardwareErrors.NewFirmwareUnRelease({ payload });
    case HardwareErrorCode.NewFirmwareForceUpdate:
      return new HardwareErrors.NewFirmwareForceUpdate({ payload });
    case HardwareErrorCode.NetworkError:
      return new HardwareErrors.NetworkError({ payload });
    case HardwareErrorCode.BlePermissionError:
      return new HardwareErrors.NeedBluetoothTurnedOn({ payload });
    case HardwareErrorCode.BleLocationError:
      return new HardwareErrors.NeedBluetoothPermissions({ payload });
    case HardwareErrorCode.BleLocationServicesDisabled:
      return new HardwareErrors.BleLocationServiceError({ payload });
    case HardwareErrorCode.BleDeviceNotBonded:
      return new HardwareErrors.DeviceNotBonded({ payload });
    case HardwareErrorCode.BleDeviceBondError:
      return new HardwareErrors.DeviceBondError({ payload });
    case HardwareErrorCode.BleWriteCharacteristicError:
      return new HardwareErrors.BleWriteCharacteristicError({ payload });
    case HardwareErrorCode.BleScanError:
      return new HardwareErrors.BleScanError({ payload });
    case HardwareErrorCode.BleAlreadyConnected:
      return new HardwareErrors.BleAlreadyConnectedError({ payload });
    case HardwareErrorCode.RuntimeError:
      if (message.indexOf('EIP712 blind sign is disabled') !== -1) {
        return new HardwareErrors.OpenBlindSign({ payload });
      }
      if (message.indexOf('Unknown message') !== -1) {
        return new HardwareErrors.UnknownMethod({ payload });
      }
      if (message.indexOf('Failure_UnexpectedMessage') !== -1) {
        return new HardwareErrors.UnknownMethod({ payload });
      }
      return new HardwareErrors.UnknownHardwareError({ payload });
    case HardwareErrorCode.PinInvalid:
      return new HardwareErrors.InvalidPIN({
        payload,
      });
    case HardwareErrorCode.DeviceCheckPassphraseStateError:
      return new HardwareErrors.InvalidPassphrase({ payload });
    case HardwareErrorCode.DeviceOpenedPassphrase:
      return new HardwareErrors.DeviceOpenedPassphrase({ payload });
    case HardwareErrorCode.DeviceNotOpenedPassphrase:
      return new HardwareErrors.DeviceNotOpenedPassphrase({ payload });
    case HardwareErrorCode.PinCancelled:
      return new HardwareErrors.PinCancelled({ payload });
    case HardwareErrorCode.ActionCancelled:
      return new HardwareErrors.UserCancel({ payload });
    case HardwareErrorCode.BridgeNotInstalled:
      return new HardwareErrors.NeedOneKeyBridge({ payload });
    case ECustomOneKeyHardwareError.NeedOneKeyBridge:
      return new HardwareErrors.NeedOneKeyBridge({ payload });
    case HardwareErrorCode.BridgeNetworkError:
      return new HardwareErrors.BridgeNetworkError({ payload });
    case HardwareErrorCode.BridgeTimeoutError:
      if (platformEnv.isDesktop) {
        window.desktopApi.reloadBridgeProcess();
      }
      return new HardwareErrors.BridgeTimeoutError({ payload });
    case HardwareErrorCode.PollingTimeout:
      return new HardwareErrors.ConnectTimeoutError({ payload });
    case HardwareErrorCode.PollingStop:
      return new HardwareErrors.ConnectPollingStopError({ payload });
    case HardwareErrorCode.BlindSignDisabled:
      return new HardwareErrors.OpenBlindSign({ payload });
    case HardwareErrorCode.FileAlreadyExists:
      return new HardwareErrors.FileAlreadyExistError({ payload });
    case HardwareErrorCode.CheckDownloadFileError:
      return new HardwareErrors.IncompleteFileError({ payload });
    case HardwareErrorCode.NotInSigningMode:
      return new HardwareErrors.NotInSigningModeError({ payload });
    case HardwareErrorCode.DataOverload:
      return new HardwareErrors.DeviceDataOverload({ payload });

    // Bridge error
    case 'ERR_BAD_REQUEST':
      return new HardwareErrors.HardwareCommunicationError({ payload });
    default:
      return new HardwareErrors.UnknownHardwareError({ payload });

    // TODO not working as HardwareErrorCode is const but not enum
    // const exhaustiveCheck: never = code;
    // throw new Error(
    //   `Unhandled hardware error code case: ${exhaustiveCheck as any}`,
    // );
  }
}

export async function convertDeviceResponse<T>(
  fn: () => Promise<IDeviceResponseResult<T>>,
): Promise<T> {
  let response: IDeviceResponseResult<T> | undefined;
  try {
    response = await fn();
  } catch (e) {
    const error: Error | undefined = e as Error;
    console.error(error);
    const hardwareCommonError = new HardwareErrors.OneKeyHardwareError(error);
    throw hardwareCommonError;
  }
  if (!response.success) {
    throw convertDeviceError(response.payload);
  }
  return response.payload;
}

export function isHardwareErrorByCode({
  error,
  code,
}: {
  error: IOneKeyError | undefined;
  code: number | Array<number | string> | undefined;
}) {
  // HardwareErrorCode
  const isHardwareError =
    error instanceof HardwareErrors.OneKeyHardwareError ||
    error?.className === EOneKeyErrorClassNames.OneKeyHardwareError ||
    error?.className === EOneKeyErrorClassNames.UnknownHardwareError ||
    error?.$isHardwareError === true;

  const isCodeMatch = (errorCode: number | undefined | string) =>
    errorCode === code ||
    (isArray(code) && !isNil(errorCode) && code.includes(errorCode));

  return (
    error &&
    isHardwareError &&
    (isCodeMatch(error?.code) || isCodeMatch(error?.payload?.code))
  );
}

export function isHardwareInterruptErrorByCode({
  error,
}: {
  error: IOneKeyError | undefined;
}) {
  return isHardwareErrorByCode({
    error,
    code: [
      HardwareErrorCode.NewFirmwareForceUpdate,
      HardwareErrorCode.BridgeNotInstalled,
      HardwareErrorCode.BridgeTimeoutError,
    ],
  });
}
