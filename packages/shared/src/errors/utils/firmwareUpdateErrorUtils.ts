import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { ETranslations } from '../../locale';
import { appLocale } from '../../locale/appLocale';
import { EOneKeyErrorClassNames } from '../types/errorTypes';

import { isHardwareErrorByCode } from './deviceErrorUtils';

import type { IOneKeyError } from '../types/errorTypes';

function getErrorText(error: IOneKeyError | undefined): string {
  return [error?.className, error?.name, error?.message]
    .filter((value): value is string => Boolean(value))
    .join(' ');
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
  return isHardwareErrorByCode({
    error,
    code: [
      HardwareErrorCode.DeviceNotFound,
      HardwareErrorCode.BridgeDeviceDisconnected,
    ],
  });
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
