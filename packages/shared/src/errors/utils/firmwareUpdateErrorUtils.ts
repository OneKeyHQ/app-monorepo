import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { ETranslations } from '../../locale';
import { appLocale } from '../../locale/appLocale';
import { EOneKeyErrorClassNames } from '../types/errorTypes';

import { isHardwareErrorByCode } from './deviceErrorUtils';

import type { IOneKeyError } from '../types/errorTypes';

export type IFirmwareUpdateFailureType =
  | 'cancelled'
  | 'device_disconnected'
  | 'download'
  | 'transfer'
  | 'install'
  | 'verification'
  | 'timeout'
  | 'unknown';

function getErrorText(error: IOneKeyError | undefined): string {
  return [error?.className, error?.name, error?.message]
    .filter((value): value is string => Boolean(value))
    .join(' ');
}

function hasFirmwareUpdateErrorCode(
  error: IOneKeyError | undefined,
  codes: number[],
) {
  const errorCode = error?.code ?? error?.payload?.code;
  const normalizedCode =
    typeof errorCode === 'string' ? Number(errorCode) : errorCode;
  return typeof normalizedCode === 'number' && codes.includes(normalizedCode);
}

export function isFirmwareUpdateCancellationError(
  error: IOneKeyError | undefined,
): boolean {
  if (!error) {
    return false;
  }
  if (
    error.className === EOneKeyErrorClassNames.FirmwareUpdateExit ||
    error.className === EOneKeyErrorClassNames.FirmwareUpdateTasksClear ||
    error.name === EOneKeyErrorClassNames.FirmwareUpdateExit ||
    error.name === EOneKeyErrorClassNames.FirmwareUpdateTasksClear
  ) {
    return true;
  }
  const text = getErrorText(error);
  return (
    text.includes('updateTasksClear') ||
    text.includes('exitUpdateWorkflow') ||
    text.includes('FirmwareUpdateExit') ||
    text.includes('FirmwareUpdateTasksClear')
  );
}

export function isFirmwareUpdateDeviceDisconnectedError(
  error: IOneKeyError | undefined,
): boolean {
  if (!error) {
    return false;
  }
  if (error.className === EOneKeyErrorClassNames.DeviceNotFound) {
    return true;
  }
  return Boolean(
    isHardwareErrorByCode({
      error,
      code: [
        HardwareErrorCode.DeviceNotFound,
        HardwareErrorCode.BridgeDeviceDisconnected,
      ],
    }) ||
    hasFirmwareUpdateErrorCode(error, [
      HardwareErrorCode.DeviceNotFound,
      HardwareErrorCode.BridgeDeviceDisconnected,
    ]),
  );
}

export function classifyFirmwareUpdateFailure(
  error: IOneKeyError | undefined,
): IFirmwareUpdateFailureType {
  if (isFirmwareUpdateCancellationError(error)) {
    return 'cancelled';
  }
  if (isFirmwareUpdateDeviceDisconnectedError(error)) {
    return 'device_disconnected';
  }
  if (
    hasFirmwareUpdateErrorCode(error, [
      HardwareErrorCode.FirmwareUpdateDownloadFailed,
      HardwareErrorCode.CheckDownloadFileError,
    ])
  ) {
    return 'download';
  }
  if (
    hasFirmwareUpdateErrorCode(error, [
      HardwareErrorCode.EmmcFileWriteFirmwareError,
      HardwareErrorCode.BleWriteCharacteristicError,
      HardwareErrorCode.BridgeNetworkError,
    ])
  ) {
    return 'transfer';
  }
  if (
    hasFirmwareUpdateErrorCode(error, [
      HardwareErrorCode.FirmwareVerificationFailed,
      HardwareErrorCode.DefectiveFirmware,
    ])
  ) {
    return 'verification';
  }
  if (
    hasFirmwareUpdateErrorCode(error, [
      HardwareErrorCode.BridgeTimeoutError,
      HardwareErrorCode.BleTimeoutError,
      HardwareErrorCode.IframeTimeout,
      HardwareErrorCode.PollingTimeout,
    ]) ||
    getErrorText(error).toLowerCase().includes('timeout')
  ) {
    return 'timeout';
  }
  if (
    hasFirmwareUpdateErrorCode(error, [
      HardwareErrorCode.FirmwareError,
      HardwareErrorCode.FirmwareDowngradeNotAllowed,
      HardwareErrorCode.FirmwareUpdateAutoEnterBootFailure,
      HardwareErrorCode.FirmwareUpdateManuallyEnterBoot,
    ])
  ) {
    return 'install';
  }
  return 'unknown';
}

export function shouldHideFirmwareUpdateInternalError(
  error: IOneKeyError | undefined,
): boolean {
  return (
    isFirmwareUpdateCancellationError(error) ||
    isFirmwareUpdateDeviceDisconnectedError(error)
  );
}

export function getFirmwareUpdateDisconnectedErrorMessage(): string {
  return appLocale.intl.formatMessage({
    id: ETranslations.update_device_disconnected_desc,
  });
}

export function toUserFacingFirmwareUpdateError(
  error: IOneKeyError,
): IOneKeyError {
  if (!shouldHideFirmwareUpdateInternalError(error)) {
    return error;
  }
  return {
    ...error,
    message: getFirmwareUpdateDisconnectedErrorMessage(),
  };
}
