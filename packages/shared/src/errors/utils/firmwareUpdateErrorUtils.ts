import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { ETranslations } from '../../locale';
import { appLocale } from '../../locale/appLocale';
import {
  ECustomOneKeyHardwareError,
  EOneKeyErrorClassNames,
} from '../types/errorTypes';

import { isHardwareErrorByCode } from './deviceErrorUtils';

import type { IOneKeyError } from '../types/errorTypes';

export type IFirmwareUpdateFailureType =
  | 'cancelled'
  | 'device_disconnected'
  | 'device_mismatch'
  | 'download'
  | 'transfer'
  | 'install'
  | 'verification'
  | 'timeout'
  | 'ble_interrupted'
  | 'requires_web'
  | 'low_battery'
  | 'requires_usb'
  | 'requires_desktop'
  | 'requires_bridge'
  | 'device_limit'
  | 'unknown';

export type IFirmwareUpdateFailurePhase = 'precondition' | 'execution';

export type IFirmwareUpdateFailureReport = {
  failureType: IFirmwareUpdateFailureType;
  failurePhase?: IFirmwareUpdateFailurePhase;
  errorCode?: string;
  errorName?: string;
  errorDetail?: string;
};

const PROTOCOL_V2_FIRMWARE_INSTALL_TIMEOUT_CODE = 'FirmwareInstallTimeout';

export const FIRMWARE_UPDATE_ERROR_DETAIL_MAX_LENGTH = 120;

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
  HardwareErrorCode.BleDeviceDisconnected,
];

const FIRMWARE_UPDATE_CANCELLATION_CODES = [
  HardwareErrorCode.PinCancelled,
  HardwareErrorCode.ActionCancelled,
  HardwareErrorCode.CallQueueActionCancelled,
  HardwareErrorCode.DeviceInterruptedFromOutside,
  HardwareErrorCode.DeviceInterruptedFromUser,
  HardwareErrorCode.PollingStop,
  HardwareErrorCode.BleTransportCallCanceled,
];

const FIRMWARE_UPDATE_FAILURE_TYPE_BY_CODE = new Map<
  number,
  IFirmwareUpdateFailureType
>([
  [HardwareErrorCode.DeviceNotFound, 'device_disconnected'],
  [HardwareErrorCode.BridgeDeviceDisconnected, 'device_disconnected'],
  [HardwareErrorCode.BleDeviceDisconnected, 'device_disconnected'],
  [HardwareErrorCode.DeviceCheckDeviceIdError, 'device_mismatch'],
  [HardwareErrorCode.FirmwareUpdateDownloadFailed, 'download'],
  [HardwareErrorCode.CheckDownloadFileError, 'download'],
  [HardwareErrorCode.BridgeTimeoutError, 'timeout'],
  [HardwareErrorCode.BleTimeoutError, 'timeout'],
  [HardwareErrorCode.IframeTimeout, 'timeout'],
  [HardwareErrorCode.PollingTimeout, 'timeout'],
  [HardwareErrorCode.EmmcFileWriteFirmwareError, 'transfer'],
  [HardwareErrorCode.BleWriteCharacteristicError, 'transfer'],
  [HardwareErrorCode.BridgeNetworkError, 'transfer'],
  [HardwareErrorCode.FirmwareVerificationFailed, 'verification'],
  [HardwareErrorCode.DefectiveFirmware, 'verification'],
  [HardwareErrorCode.FirmwareError, 'install'],
  [HardwareErrorCode.FirmwareDowngradeNotAllowed, 'install'],
  [HardwareErrorCode.FirmwareUpdateAutoEnterBootFailure, 'install'],
  [HardwareErrorCode.FirmwareUpdateManuallyEnterBoot, 'install'],
  [HardwareErrorCode.BleForceCleanRunPromise, 'ble_interrupted'],
  [ECustomOneKeyHardwareError.NeedFirmwareUpgradeFromWeb, 'requires_web'],
  [ECustomOneKeyHardwareError.FirmwareUpdateBatteryTooLow, 'low_battery'],
  [
    ECustomOneKeyHardwareError.FirmwareUpdateRequiresUsbTransport,
    'requires_usb',
  ],
  [HardwareErrorCode.UseDesktopToUpdateFirmware, 'requires_desktop'],
  [ECustomOneKeyHardwareError.NeedOneKeyBridgeUpgrade, 'requires_bridge'],
  [HardwareErrorCode.FirmwareUpdateLimitOneDevice, 'device_limit'],
]);

const FIRMWARE_UPDATE_PRECONDITION_FAILURE_TYPES =
  new Set<IFirmwareUpdateFailureType>([
    'device_mismatch',
    'requires_web',
    'low_battery',
    'requires_usb',
    'requires_desktop',
    'requires_bridge',
    'device_limit',
  ]);

const FIRMWARE_UPDATE_EXECUTION_FAILURE_TYPES =
  new Set<IFirmwareUpdateFailureType>([
    'device_disconnected',
    'download',
    'transfer',
    'install',
    'verification',
    'timeout',
    'ble_interrupted',
  ]);

const SAFE_FIRMWARE_UPDATE_ERROR_NAMES = new Set<string>([
  EOneKeyErrorClassNames.OneKeyError,
  EOneKeyErrorClassNames.OneKeyAppError,
  EOneKeyErrorClassNames.OneKeyLocalError,
  EOneKeyErrorClassNames.OneKeyHardwareError,
  EOneKeyErrorClassNames.UnknownHardwareError,
  EOneKeyErrorClassNames.DeviceNotFound,
  EOneKeyErrorClassNames.FirmwareUpdateExit,
  EOneKeyErrorClassNames.FirmwareUpdateTasksClear,
]);

const SAFE_FIRMWARE_UPDATE_ERROR_DETAILS = new Set<string>([
  'Desktop firmware updates require a USB transport',
  'Firmware update background task failed to start',
  'Firmware update plan is required for Protocol V2 updates',
  'Firmware update plan selected an incompatible executor',
  'checkAllFirmwareRelease ERROR: native ble-sdk connectId is required',
  'setFirmwareUpdateInfo ERROR: features is required',
  'mnemonic not backuped',
  'USB not connected',
  'Retry Timeout',
  'Force clean Bluetooth run promise',
]);

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

function getNormalizedFirmwareUpdateErrorCodes(
  error: IOneKeyError | undefined,
): number[] {
  const codes: number[] = [];
  for (const code of getFirmwareUpdateErrorCodes(error)) {
    const normalizedCode = typeof code === 'string' ? Number(code) : code;
    if (Number.isFinite(normalizedCode)) {
      codes.push(normalizedCode);
    }
  }
  return codes;
}

function getFirstMappedFirmwareUpdateFailure(
  error: IOneKeyError | undefined,
): { code: number; failureType: IFirmwareUpdateFailureType } | undefined {
  for (const code of getNormalizedFirmwareUpdateErrorCodes(error)) {
    const failureType = FIRMWARE_UPDATE_FAILURE_TYPE_BY_CODE.get(code);
    if (failureType) {
      return { code, failureType };
    }
  }
  return undefined;
}

function isProtocolV2FirmwareInstallTimeout(
  error: IOneKeyError | undefined,
): boolean {
  return (
    error?.payload?.params?.firmwareUpdateCode ===
    PROTOCOL_V2_FIRMWARE_INSTALL_TIMEOUT_CODE
  );
}

function isArtifactDownloadErrorCode(code: string | undefined): boolean {
  return (
    !!code &&
    (FIRMWARE_ARTIFACT_DOWNLOAD_ERROR_CODES.has(code) ||
      /^ARTIFACT_HTTP_\d+$/u.test(code))
  );
}

function hasFirmwareUpdateTimeoutText(error: IOneKeyError | undefined) {
  const text = getErrorText(error).toLowerCase();
  return text.includes('timeout') || text.includes('timed out');
}

function readSafeFirmwareUpdateErrorName(
  value: string | undefined,
): string | undefined {
  const name = value?.trim();
  if (!name || !SAFE_FIRMWARE_UPDATE_ERROR_NAMES.has(name)) {
    return undefined;
  }
  return name;
}

export function limitFirmwareUpdateErrorDetail(detail: string): string {
  if (detail.length <= FIRMWARE_UPDATE_ERROR_DETAIL_MAX_LENGTH) {
    return detail;
  }
  return detail.slice(0, FIRMWARE_UPDATE_ERROR_DETAIL_MAX_LENGTH);
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
    hasFirmwareUpdateErrorCode(error, FIRMWARE_UPDATE_CANCELLATION_CODES) ||
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
  const mappedFailure = getFirstMappedFirmwareUpdateFailure(error);
  if (
    mappedFailure?.failureType === 'install' &&
    mappedFailure.code === HardwareErrorCode.FirmwareError &&
    isProtocolV2FirmwareInstallTimeout(error)
  ) {
    return 'timeout';
  }
  if (mappedFailure) {
    return mappedFailure.failureType;
  }
  if (error?.className === EOneKeyErrorClassNames.DeviceNotFound) {
    return 'device_disconnected';
  }
  if (isArtifactDownloadErrorCode(getFirmwareArtifactErrorCode(error))) {
    return 'download';
  }
  if (hasFirmwareUpdateTimeoutText(error)) {
    return 'timeout';
  }
  return 'unknown';
}

export function resolveFirmwareUpdateFailurePhase(
  failureType: IFirmwareUpdateFailureType,
): IFirmwareUpdateFailurePhase | undefined {
  if (FIRMWARE_UPDATE_PRECONDITION_FAILURE_TYPES.has(failureType)) {
    return 'precondition';
  }
  if (FIRMWARE_UPDATE_EXECUTION_FAILURE_TYPES.has(failureType)) {
    return 'execution';
  }
  return undefined;
}

export function resolveFirmwareUpdateErrorName(
  error: IOneKeyError | undefined,
): string | undefined {
  return (
    readSafeFirmwareUpdateErrorName(error?.className) ??
    readSafeFirmwareUpdateErrorName(error?.name)
  );
}

export function resolveFirmwareUpdateErrorDetail(
  error: IOneKeyError | undefined,
): string | undefined {
  const message = error?.message?.trim();
  if (!message || !SAFE_FIRMWARE_UPDATE_ERROR_DETAILS.has(message)) {
    return undefined;
  }
  return limitFirmwareUpdateErrorDetail(message);
}

function resolveClassifiedFirmwareUpdateErrorCode(
  error: IOneKeyError | undefined,
  failureType: IFirmwareUpdateFailureType,
): string | undefined {
  const mappedFailure = getFirstMappedFirmwareUpdateFailure(error);
  if (mappedFailure && mappedFailure.failureType === failureType) {
    return String(mappedFailure.code);
  }
  return resolveFirmwareUpdateErrorCode(error);
}

export function buildFirmwareUpdateFailureReport(
  error: IOneKeyError | undefined,
): IFirmwareUpdateFailureReport {
  const failureType = classifyFirmwareUpdateFailure(error);
  const report: IFirmwareUpdateFailureReport = {
    failureType,
  };
  const failurePhase = resolveFirmwareUpdateFailurePhase(failureType);
  if (failurePhase) {
    report.failurePhase = failurePhase;
  }
  const errorCode = resolveClassifiedFirmwareUpdateErrorCode(
    error,
    failureType,
  );
  const errorName = resolveFirmwareUpdateErrorName(error);
  const errorDetail = resolveFirmwareUpdateErrorDetail(error);
  if (errorCode !== undefined) {
    report.errorCode = errorCode;
  }
  if (errorName !== undefined) {
    report.errorName = errorName;
  }
  if (errorDetail !== undefined) {
    report.errorDetail = errorDetail;
  }
  return report;
}

export function readFirmwareUpdateFailureTracking(
  error: IOneKeyError | undefined,
): {
  lastFailureType: IFirmwareUpdateFailureType | undefined;
  lastFailurePhase: IFirmwareUpdateFailurePhase | undefined;
  lastErrorCode: string | undefined;
  lastErrorName: string | undefined;
  lastErrorDetail: string | undefined;
} {
  const empty = {
    lastFailureType: undefined,
    lastFailurePhase: undefined,
    lastErrorCode: undefined,
    lastErrorName: undefined,
    lastErrorDetail: undefined,
  };
  if (!error) {
    return empty;
  }
  const report = buildFirmwareUpdateFailureReport(error);
  if (report.failureType === 'cancelled') {
    return empty;
  }
  return {
    lastFailureType: report.failureType,
    lastFailurePhase: report.failurePhase,
    lastErrorCode: report.errorCode,
    lastErrorName: report.errorName,
    lastErrorDetail: report.errorDetail,
  };
}

export function resolveReportedFirmwareUpdateFailure({
  error,
  previous,
}: {
  error: IOneKeyError | undefined;
  previous?: Partial<IFirmwareUpdateFailureReport>;
}): IFirmwareUpdateFailureReport | undefined {
  const current = buildFirmwareUpdateFailureReport(error);
  if (current.failureType !== 'cancelled') {
    return current;
  }
  if (!previous?.failureType || previous.failureType === 'cancelled') {
    return undefined;
  }
  const previousReport: IFirmwareUpdateFailureReport = {
    failureType: previous.failureType,
  };
  if (previous.failurePhase) {
    previousReport.failurePhase = previous.failurePhase;
  }
  if (previous.errorCode) {
    previousReport.errorCode = previous.errorCode;
  }
  if (previous.errorName) {
    previousReport.errorName = previous.errorName;
  }
  if (previous.errorDetail) {
    previousReport.errorDetail = previous.errorDetail;
  }
  return previousReport;
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
