import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import axios from 'axios';
import { isPlainObject } from 'lodash';

import type { ETranslations } from '@onekeyhq/shared/src/locale';

import { EAppEventBusNames, appEventBus } from '../../eventBus/appEventBus';
import { EOneKeyErrorClassNames, type IOneKeyError } from '../types/errorTypes';

function fixAxiosAbortCancelError(error: unknown) {
  if (error && axios.isCancel(error)) {
    (error as IOneKeyError).className =
      (error as IOneKeyError).className ||
      EOneKeyErrorClassNames.AxiosAbortCancelError;
  }
}

let lastToastErrorInstance: IOneKeyError | undefined;
function showToastOfError(error: IOneKeyError | unknown | undefined) {
  fixAxiosAbortCancelError(error);
  const err = error as IOneKeyError | undefined;
  if (
    err?.className &&
    [
      // ignore auto toast errors
      EOneKeyErrorClassNames.HardwareUserCancelFromOutside,
      EOneKeyErrorClassNames.PrimeLoginDialogCancelError,
      EOneKeyErrorClassNames.SecureQRCodeDialogCancel,
      EOneKeyErrorClassNames.PasswordPromptDialogCancel,
      EOneKeyErrorClassNames.OneKeyErrorScanQrCodeCancel,
      EOneKeyErrorClassNames.FirmwareUpdateExit,
      EOneKeyErrorClassNames.FirmwareUpdateTasksClear,
      EOneKeyErrorClassNames.WebDeviceNotFoundOrNeedsPermission,
      EOneKeyErrorClassNames.OneKeyErrorAirGapAccountNotFound,
      EOneKeyErrorClassNames.OneKeyErrorAirGapStandardWalletRequiredWhenCreateHiddenWallet,
      EOneKeyErrorClassNames.AxiosAbortCancelError,
      // use Dialog instead of Toast, check GlobalErrorHandlerContainer
      EOneKeyErrorClassNames.DeviceNotOpenedPassphrase,
      EOneKeyErrorClassNames.DeviceNotFound,
    ].includes(err?.className)
  ) {
    return;
  }
  // Ignore DefectiveFirmware errors - use Dialog instead of Toast
  if (err?.code === HardwareErrorCode.DefectiveFirmware) {
    return;
  }
  let shouldMuteToast = false;
  if (
    err?.className === EOneKeyErrorClassNames.OneKeyServerApiError &&
    !err?.message
  ) {
    shouldMuteToast = true;
  }
  const isTriggered = err?.$$autoToastErrorTriggered;
  const isSameError = lastToastErrorInstance === err;
  // TODO log error to file if developer mode on
  if (
    err &&
    err?.autoToast &&
    !isTriggered &&
    !isSameError &&
    !shouldMuteToast
  ) {
    err.$$autoToastErrorTriggered = true;
    lastToastErrorInstance = err;
    appEventBus.emit(EAppEventBusNames.ShowToast, {
      errorCode: err?.code,
      method: 'error',
      title: err?.message ?? 'Error',
      message: err?.requestId,
      i18nKey: err?.key as ETranslations | undefined,
    });
  }
}

function toastIfError(error: unknown) {
  fixAxiosAbortCancelError(error);
  // Some third-party libraries or external wallets return not an Error object, but a normal JSON object. Here we need to use isPlainObject to do a compatible processing.

  if (error instanceof Error || isPlainObject(error)) {
    const e = error as IOneKeyError | undefined;

    if (e) {
      // handle autoToast error by BackgroundApiProxyBase
      e.autoToast = true;
    }
  }
}

function toastIfErrorDisable(error: unknown) {
  fixAxiosAbortCancelError(error);
  // Some third-party libraries or external wallets return not an Error object, but a normal JSON object. Here we need to use isPlainObject to do a compatible processing.

  if (error instanceof Error || isPlainObject(error)) {
    const e = error as IOneKeyError | undefined;
    if (e) {
      e.autoToast = false;
    }
  }
}

async function withErrorAutoToast<T>(
  fn: () => Promise<T>,
  options: {
    alwaysShowToast?: boolean;
  } = {},
) {
  try {
    const result = await fn();
    return result;
  } catch (error: unknown) {
    fixAxiosAbortCancelError(error);
    const alwaysShowToast = options?.alwaysShowToast ?? true;
    if (alwaysShowToast) {
      toastIfError(error);
    }
    showToastOfError(error);
    throw error;
  }
}

export default {
  toastIfError,
  toastIfErrorDisable,
  showToastOfError,
  withErrorAutoToast,
};
