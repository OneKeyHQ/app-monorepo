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

const FIRMWARE_ARTIFACT_ERROR_CODE_PATTERN = /\b(ARTIFACT_[A-Z0-9_]+)\b/u;

const FIRMWARE_ARTIFACT_DOWNLOAD_ERROR_CODES = new Set([
  'ARTIFACT_NETWORK_FAILED',
  'ARTIFACT_TLS_FAILED',
  'ARTIFACT_INTEGRITY_FAILED',
  'ARTIFACT_ARCHIVE_INVALID',
  'ARTIFACT_PROTOCOL_INVALID',
]);

const FIRMWARE_DISCONNECT_ERROR_CODES = [
  HardwareErrorCode.DeviceNotFound,
  HardwareErrorCode.BridgeDeviceDisconnected,
  HardwareErrorCode.BleDeviceBondError,
  HardwareErrorCode.BleDeviceDisconnected,
  HardwareErrorCode.BlePeerRemovedPairingInformation,
  HardwareErrorCode.BleBondInvalid,
];

function getErrorText(error: IOneKeyError | undefined): string {
  return [
    error?.className,
    error?.name,
    error?.message,
    error?.payload?.error,
    error?.payload?.message,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ');
}

function getFirmwareUpdateErrorCodes(
  error: IOneKeyError | undefined,
): (number | string)[] {
  return [
    error?.payload?.params?.causeCode,
    error?.payload?.code,
    error?.code,
  ].filter(
    (code): code is number | string =>
      typeof code === 'number' || typeof code === 'string',
  );
}

function getFirmwareArtifactErrorCode(
  error: IOneKeyError | undefined,
): string | undefined {
  return FIRMWARE_ARTIFACT_ERROR_CODE_PATTERN.exec(getErrorText(error))?.[1];
}

export function resolveFirmwareUpdateErrorCode(
  error: IOneKeyError | undefined,
): string | undefined {
  const rawCode = getFirmwareUpdateErrorCodes(error).find((code) =>
    typeof code === 'number' ? Number.isFinite(code) : code.trim().length > 0,
  );
  if (rawCode !== undefined) {
    return String(rawCode).trim();
  }
  return getFirmwareArtifactErrorCode(error);
}

function hasFirmwareUpdateErrorCode(
  error: IOneKeyError | undefined,
  codes: number[],
) {
  return getFirmwareUpdateErrorCodes(error).some((errorCode) => {
    const normalizedCode =
      typeof errorCode === 'string' ? Number(errorCode) : errorCode;
    return Number.isFinite(normalizedCode) && codes.includes(normalizedCode);
  });
}

function isFirmwareUpdateInternalCancellationError(
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

export function isFirmwareUpdateCancellationError(
  error: IOneKeyError | undefined,
): boolean {
  return (
    isFirmwareUpdateInternalCancellationError(error) ||
    hasFirmwareUpdateErrorCode(error, [
      HardwareErrorCode.PinCancelled,
      HardwareErrorCode.ActionCancelled,
      HardwareErrorCode.CallQueueActionCancelled,
      HardwareErrorCode.DeviceInterruptedFromOutside,
      HardwareErrorCode.DeviceInterruptedFromUser,
      HardwareErrorCode.PollingStop,
      HardwareErrorCode.BleTransportCallCanceled,
    ]) ||
    getFirmwareArtifactErrorCode(error) === 'ARTIFACT_CANCELLED'
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
      code: FIRMWARE_DISCONNECT_ERROR_CODES,
    }) || hasFirmwareUpdateErrorCode(error, FIRMWARE_DISCONNECT_ERROR_CODES),
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
    ]) ||
    FIRMWARE_ARTIFACT_DOWNLOAD_ERROR_CODES.has(
      getFirmwareArtifactErrorCode(error) ?? '',
    ) ||
    /^ARTIFACT_HTTP_\d+$/u.test(getFirmwareArtifactErrorCode(error) ?? '')
  ) {
    return 'download';
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
    isFirmwareUpdateInternalCancellationError(error) ||
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
